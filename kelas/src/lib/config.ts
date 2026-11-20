/*
 * Batas operasional dan konstanta waktu (REQUIREMENTS.md Bagian 5, DECISIONS D-13/D-14).
 */

export const MAX_SB3_SIZE_BYTES = Number(process.env.MAX_SB3_SIZE_BYTES ?? 52428800);

// Minimal 20 detik antar snapshot otomatis untuk tugas dan murid yang sama.
export const AUTOSAVE_MIN_INTERVAL_SECONDS = 20;

// Masa toleransi singkat untuk menyelesaikan unggahan akhir setelah tenggat.
export const SAVE_INTENT_TOLERANCE_SECONDS = 30;

// Batas awal murid per kelas (REQUIREMENTS.md Bagian 5).
export const MAX_MURID_PER_KELAS = 60;

// Retensi snapshot biasa per (assignment_id, student_id) (DATABASE.md Bagian 7).
export const RETENSI_SNAPSHOT_NORMAL = 20;

// Batas panjang komentar (REQUIREMENTS.md Bagian 5).
export const MAX_KOMENTAR_PANJANG = 2000;
