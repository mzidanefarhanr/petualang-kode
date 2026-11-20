import {AwsClient} from 'aws4fetch';
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {toArrayBuffer} from './files';

/*
 * Object storage S3-kompatibel, bucket privat.
 *
 * `object_key` hanya hidup di server dan tidak pernah dikirim ke klien.
 * Isi `.sb3` disimpan sebagai byte mentah apa adanya.
 *
 * Client memakai `aws4fetch` (fetch berbasis Web Crypto, tanpa dependensi).
 * Endpoint memakai mode path-style agar cocok dengan MinIO/R2/S3.
 */

export interface ObjectStorage {
    put(key: string, bytes: Uint8Array, contentType?: string): Promise<void>;
    get(key: string): Promise<Uint8Array>;
    delete(key: string): Promise<void>;
}

class S3Storage implements ObjectStorage {
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
        const response = await this.client.fetch(this.url(key), {
            method: 'PUT',
            body: toArrayBuffer(bytes),
            headers: {'Content-Type': contentType}
        });
        if (!response.ok) {
            throw new Error(`Gagal menyimpan objek (${response.status}).`);
        }
    }

    async get(key: string): Promise<Uint8Array> {
        const response = await this.client.fetch(this.url(key), {method: 'GET'});
        if (!response.ok) {
            throw new Error(`Gagal membaca objek (${response.status}).`);
        }
        return new Uint8Array(await response.arrayBuffer());
    }

    async delete(key: string): Promise<void> {
        const response = await this.client.fetch(this.url(key), {method: 'DELETE'});
        if (!response.ok && response.status !== 404) {
            throw new Error(`Gagal menghapus objek (${response.status}).`);
        }
    }
}

/*
 * Penyimpanan dalam memori untuk pengujian. Menyalin byte agar tidak ada
 * referensi bersama yang tidak sengaja mengubah data.
 */
export class MemoryStorage implements ObjectStorage {
    private readonly map = new Map<string, Uint8Array>();

    async put(key: string, bytes: Uint8Array): Promise<void> {
        this.map.set(key, Uint8Array.from(bytes));
    }

    async get(key: string): Promise<Uint8Array> {
        const value = this.map.get(key);
        if (!value) {
            throw new Error(`Objek tidak ditemukan: ${key}`);
        }
        return Uint8Array.from(value);
    }

    async delete(key: string): Promise<void> {
        this.map.delete(key);
    }
}

/*
 * Penyimpanan lokal (filesystem) untuk pengembangan/pengujian tanpa S3.
 * Tidak dipakai bila object storage S3 dikonfigurasi.
 */
export class LocalStorage implements ObjectStorage {
    constructor(private readonly baseDir: string) {}

    private filePath(key: string): string {
        return join(this.baseDir, key);
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

let override: ObjectStorage | null = null;
let singleton: ObjectStorage | null = null;

export function setStorage(storage: ObjectStorage | null): void {
    override = storage;
}

export function getStorage(): ObjectStorage {
    if (override) {
        return override;
    }
    if (!singleton) {
        const driver = process.env.OBJECT_STORAGE || (process.env.S3_ACCESS_KEY_ID ? 's3' : 'local');
        if (driver === 'local') {
            singleton = new LocalStorage(
                process.env.OBJECT_STORAGE_DIR || join(process.cwd(), '.objects')
            );
        } else {
            singleton = new S3Storage({
                endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
                bucket: process.env.S3_BUCKET ?? 'scratch-kelas',
                region: process.env.S3_REGION ?? 'us-east-1',
                accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
                secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? ''
            });
        }
    }
    return singleton;
}
