import {AwsClient} from 'aws4fetch';
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {dirname, resolve, sep} from 'node:path';
import {MAX_MEDIA_SIZE_BYTES} from './config';
import {ApiError} from './http/errors';

export interface MediaStorage {
    put(key: string, bytes: Uint8Array, contentType?: string): Promise<void>;
    get(key: string): Promise<Uint8Array>;
    delete(key: string): Promise<void>;
}

const MIME_MAP: Record<string, {jenis: 'image' | 'audio'; ext: string; canonicalMime: string}> = {
    'image/png': {jenis: 'image', ext: '.png', canonicalMime: 'image/png'},
    'image/jpeg': {jenis: 'image', ext: '.jpg', canonicalMime: 'image/jpeg'},
    'image/jpg': {jenis: 'image', ext: '.jpg', canonicalMime: 'image/jpeg'},
    'image/webp': {jenis: 'image', ext: '.webp', canonicalMime: 'image/webp'},
    'image/gif': {jenis: 'image', ext: '.gif', canonicalMime: 'image/gif'},
    'audio/mpeg': {jenis: 'audio', ext: '.mp3', canonicalMime: 'audio/mpeg'},
    'audio/mp3': {jenis: 'audio', ext: '.mp3', canonicalMime: 'audio/mpeg'},
    'audio/wav': {jenis: 'audio', ext: '.wav', canonicalMime: 'audio/wav'},
    'audio/x-wav': {jenis: 'audio', ext: '.wav', canonicalMime: 'audio/wav'},
    'audio/ogg': {jenis: 'audio', ext: '.ogg', canonicalMime: 'audio/ogg'},
    'audio/webm': {jenis: 'audio', ext: '.webm', canonicalMime: 'audio/webm'}
};

export function validateMediaUpload(input: {
    mimeType: string;
    sizeBytes: number;
    expectedJenis?: 'image' | 'audio';
}): {jenis: 'image' | 'audio'; ext: string; canonicalMime: string} {
    if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
        throw new ApiError(400, 'BERKAS_KOSONG', 'Berkas media tidak boleh kosong.');
    }
    if (input.sizeBytes > MAX_MEDIA_SIZE_BYTES) {
        throw new ApiError(
            413,
            'UKURAN_MEDIA_TERLALU_BESAR',
            'Ukuran berkas media melebihi batas maksimal 10 MB.'
        );
    }

    const normalizedMime = (input.mimeType || '').trim().toLowerCase().split(';')[0];
    const spec = MIME_MAP[normalizedMime];
    if (!spec) {
        throw new ApiError(
            400,
            'TIPE_MEDIA_TIDAK_DIDUKUNG',
            'Tipe berkas tidak didukung. Gunakan PNG/JPG/WebP/GIF untuk gambar atau MP3/WAV/OGG untuk suara.'
        );
    }

    if (input.expectedJenis && spec.jenis !== input.expectedJenis) {
        throw new ApiError(
            400,
            'JENIS_MEDIA_TIDAK_SESUAI',
            `Berkas ini bertipe ${spec.jenis}, bukan ${input.expectedJenis}.`
        );
    }

    return spec;
}

export class LocalMediaStorage implements MediaStorage {
    private readonly baseDir: string;

    constructor(baseDir: string) {
        this.baseDir = resolve(baseDir);
    }

    private filePath(key: string): string {
        const target = resolve(this.baseDir, key);
        if (target !== this.baseDir && !target.startsWith(this.baseDir + sep)) {
            throw new ApiError(400, 'KEY_TIDAK_VALID', 'Lokasi berkas tidak valid.');
        }
        return target;
    }

    async put(key: string, bytes: Uint8Array): Promise<void> {
        const target = this.filePath(key);
        await mkdir(dirname(target), {recursive: true});
        await writeFile(target, bytes);
    }

    async get(key: string): Promise<Uint8Array> {
        return new Uint8Array(await readFile(this.filePath(key)));
    }

    async delete(key: string): Promise<void> {
        await rm(this.filePath(key), {force: true});
    }
}

export class MemoryMediaStorage implements MediaStorage {
    private readonly map = new Map<string, Uint8Array>();

    async put(key: string, bytes: Uint8Array): Promise<void> {
        this.map.set(key, Uint8Array.from(bytes));
    }

    async get(key: string): Promise<Uint8Array> {
        const value = this.map.get(key);
        if (!value) {
            throw new Error(`Media tidak ditemukan: ${key}`);
        }
        return Uint8Array.from(value);
    }

    async delete(key: string): Promise<void> {
        this.map.delete(key);
    }
}

class S3MediaStorage implements MediaStorage {
    private readonly client: AwsClient;
    private readonly base: string;

    constructor(config: {
        endpoint: string;
        bucket: string;
        region: string;
        accessKeyId: string;
        secretAccessKey: string;
    }) {
        this.client = new AwsClient({
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
            service: 's3',
            region: config.region
        });
        this.base = `${config.endpoint.replace(/\/$/, '')}/${config.bucket}`;
    }

    private url(key: string): string {
        return `${this.base}/${key}`;
    }

    async put(key: string, bytes: Uint8Array, contentType = 'application/octet-stream'): Promise<void> {
        const ab = bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength
        ) as ArrayBuffer;
        const response = await this.client.fetch(this.url(key), {
            method: 'PUT',
            body: ab,
            headers: {'Content-Type': contentType}
        });
        if (!response.ok) {
            throw new Error(`Gagal menyimpan media (${response.status}).`);
        }
    }

    async get(key: string): Promise<Uint8Array> {
        const response = await this.client.fetch(this.url(key), {method: 'GET'});
        if (!response.ok) {
            throw new Error(`Gagal membaca media (${response.status}).`);
        }
        return new Uint8Array(await response.arrayBuffer());
    }

    async delete(key: string): Promise<void> {
        const response = await this.client.fetch(this.url(key), {method: 'DELETE'});
        if (!response.ok && response.status !== 404) {
            throw new Error(`Gagal menghapus media (${response.status}).`);
        }
    }
}

let overrideStorage: MediaStorage | null = null;
let singletonStorage: MediaStorage | null = null;

export function setMediaStorage(storage: MediaStorage | null): void {
    overrideStorage = storage;
}

export function getMediaStorage(): MediaStorage {
    if (overrideStorage) {
        return overrideStorage;
    }
    if (!singletonStorage) {
        const driver = process.env.MEDIA_STORAGE || 'local';
        if (driver === 's3') {
            singletonStorage = new S3MediaStorage({
                endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
                bucket: process.env.S3_BUCKET ?? 'petualang-kode',
                region: process.env.S3_REGION ?? 'ap-southeast-1',
                accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
                secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? ''
            });
        } else {
            singletonStorage = new LocalMediaStorage(
                process.env.MEDIA_DIR || resolve(process.cwd(), '.media')
            );
        }
    }
    return singletonStorage;
}
