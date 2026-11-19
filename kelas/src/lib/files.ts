import {createHash, randomUUID} from 'node:crypto';

/*
 * Utilitas berkas `.sb3`.
 *
 * Server hanya menghitung SHA-256 dan ukuran byte dari byte asli.
 * Server TIDAK PERNAH membuka ZIP, mengurai `project.json`, atau mengubah isi.
 */

export function sha256Hex(bytes: Uint8Array): string {
    return createHash('sha256').update(bytes).digest('hex');
}

export function sha256HexText(text: string): string {
    return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function newId(): string {
    return randomUUID();
}

// Menghasilkan ArrayBuffer tepat sebesar byte (tanpa bagian lain dari buffer asal),
// agar tipe memenuhi BodyInit/BufferSource secara aman.
export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export const HASH_RE = /^[0-9a-f]{64}$/;

export const snapshotKey = (assignmentId: string, studentId: string, snapshotId: string): string =>
    `snapshots/${assignmentId}/${studentId}/${snapshotId}.sb3`;

export const submissionKey = (assignmentId: string, studentId: string, submissionId: string): string =>
    `submissions/${assignmentId}/${studentId}/${submissionId}.sb3`;
