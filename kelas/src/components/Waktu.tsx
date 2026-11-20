'use client';

import {useEffect, useState} from 'react';
import {formatTanggal, formatWaktu} from '@/lib/format';

/*
 * Menampilkan waktu dalam zona waktu lokal pembaca.
 * Diformat di klien agar sesuai jam perangkat pembaca.
 */
export function Waktu({iso, tanggal = false}: {iso: string; tanggal?: boolean}) {
    const [text, setText] = useState('');

    useEffect(() => {
        const date = new Date(iso);
        setText(tanggal ? formatTanggal(date) : formatWaktu(date));
    }, [iso, tanggal]);

    return <time dateTime={iso}>{text || '…'}</time>;
}
