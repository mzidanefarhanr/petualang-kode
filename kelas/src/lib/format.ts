/*
 * Format waktu lokal pembaca.
 * Contoh: "Senin, 10 November, jam 15.00".
 */

export function formatWaktu(date: Date): string {
    const tanggal = new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    }).format(date);
    const jam = new Intl.DateTimeFormat('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    })
        .format(date)
        .replace(':', '.');
    return `${tanggal}, jam ${jam}`;
}

export function formatTanggal(date: Date): string {
    return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }).format(date);
}
