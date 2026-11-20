/*
 * Batas operasional Petualang Kode v1 (REQUIREMENTS.md Bagian 5 & DECISIONS.md).
 */

export const MAX_MEDIA_SIZE_BYTES = Number(process.env.MAX_MEDIA_SIZE_BYTES ?? 10 * 1024 * 1024);

export const MAX_LIVE_STUDENTS = Math.min(20, Math.max(1, Number(process.env.MAX_LIVE_STUDENTS ?? 20)));

export const MAX_STORY_DURATION_MS = 300_000;

export const MAX_GRID_COLS = 16;
export const MAX_GRID_ROWS = 12;

export const MAX_CHALLENGE_STEPS = 200;

export const MIN_USERNAME_LENGTH = 3;
export const MIN_PASSWORD_LENGTH = 4;
