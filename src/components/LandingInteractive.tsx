'use client';

import {useEffect, useState} from 'react';
import {useRouter} from 'next/navigation';

export function HeroJoinCodeForm() {
    const [kode, setKode] = useState('');
    const router = useRouter();

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const cleaned = kode.trim().toUpperCase();
        if (!cleaned) {
            return;
        }
        router.push(`/join/${encodeURIComponent(cleaned)}`);
    }

    return (
        <form onSubmit={handleSubmit} className="pk-kode-wrap" aria-labelledby="hero-kode-label">
            <label id="hero-kode-label" htmlFor="hero-kode-input" className="pk-kode-label">
                Gabung kelas dengan kode dari guru
            </label>
            <div className="pk-kode-row">
                <input
                    id="hero-kode-input"
                    name="kode"
                    className="pk-kode-input"
                    type="text"
                    placeholder="Contoh: KODE5A"
                    maxLength={12}
                    required
                    value={kode}
                    onChange={e => setKode(e.target.value)}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    enterKeyHint="go"
                />
                <button type="submit" className="pk-btn-gabung">
                    Gabung kelas
                </button>
            </div>
            <p className="mt-2 text-xs font-semibold text-white/75">
                Gunakan akun siswa yang sudah dibuatkan oleh gurumu untuk masuk ke kelas.
            </p>
        </form>
    );
}

export function LiveScreensPreviewGrid() {
    const [wave, setWave] = useState(0);

    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }
        const timer = window.setInterval(() => {
            setWave(prev => (prev + 1) % 7);
        }, 650);
        return () => window.clearInterval(timer);
    }, []);

    return (
        <div className="pk-screens-grid" aria-hidden="true">
            {Array.from({length: 14}).map((_, idx) => {
                const synced = (idx + wave) % 7 < 5;
                return (
                    <div key={idx} className={`pk-scr ${synced ? 'sync' : ''}`}>
                        📺
                    </div>
                );
            })}
            <div className="pk-scr">+6</div>
        </div>
    );
}
