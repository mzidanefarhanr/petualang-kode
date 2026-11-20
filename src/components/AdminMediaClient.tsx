'use client';

import {useRouter} from 'next/navigation';
import {useState} from 'react';

export interface MediaAssetClientItem {
    id: string;
    nama: string;
    jenis: 'image' | 'audio';
    mime_type: string;
    ukuran_bytes: number;
    url: string;
}

export function AdminMediaClient({initialMedia}: {initialMedia: MediaAssetClientItem[]}) {
    const router = useRouter();
    const [tab, setTab] = useState<'all' | 'image' | 'audio'>('all');
    const [nama, setNama] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const filtered =
        tab === 'all' ? initialMedia : initialMedia.filter(item => item.jenis === tab);

    async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        setLoading(true);
        setError('');

        const res = await fetch('/api/v1/admin/media', {
            method: 'POST',
            body: formData
        });
        const data = await res.json().catch(() => ({}));
        setLoading(false);

        if (!res.ok) {
            setError(data?.error?.pesan || 'Gagal mengunggah media.');
            return;
        }
        setNama('');
        form.reset();
        router.refresh();
    }

    async function handleDelete(id: string) {
        setError('');
        const res = await fetch(`/api/v1/admin/media/${id}`, {method: 'DELETE'});
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setError(data?.error?.pesan || 'Tidak dapat menghapus aset.');
            return;
        }
        router.refresh();
    }

    return (
        <div className="grid gap-8 md:grid-cols-[1.5fr_1fr]">
            <section>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-black" style={{color: 'var(--navy)'}}>
                        Koleksi Aset ({filtered.length})
                    </h2>
                    <div className="flex gap-1.5" role="tablist" aria-label="Filter jenis media">
                        {(
                            [
                                {key: 'all', label: 'Semua'},
                                {key: 'image', label: 'Gambar'},
                                {key: 'audio', label: 'Suara'}
                            ] as const
                        ).map(t => (
                            <button
                                key={t.key}
                                type="button"
                                role="tab"
                                aria-selected={tab === t.key}
                                onClick={() => setTab(t.key)}
                                className={`rounded-lg px-3 py-1 text-xs font-extrabold ${
                                    tab === t.key
                                        ? 'bg-[#1e2d5a] text-white'
                                        : 'border border-slate-200 bg-white text-slate-600'
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {error && (
                    <p
                        role="status"
                        className="mb-4 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-700"
                    >
                        {error}
                    </p>
                )}

                {filtered.length === 0 ? (
                    <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500">
                        Belum ada aset pada kategori ini. Unggah gambar atau suara melalui formulir
                        di sebelah kanan.
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                        {filtered.map(item => (
                            <div
                                key={item.id}
                                className="flex flex-col justify-between rounded-2xl border-2 border-slate-200 bg-white p-4"
                            >
                                <div>
                                    {item.jenis === 'image' ? (
                                        <div className="mb-3 flex h-36 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                                            <img
                                                src={item.url}
                                                alt={item.nama}
                                                loading="lazy"
                                                className="max-h-36 w-auto object-contain"
                                            />
                                        </div>
                                    ) : (
                                        <div className="mb-3 rounded-xl bg-teal-50/70 p-3">
                                            <div className="mb-2 text-xs font-extrabold text-teal-900">
                                                ♪ Pratinjau Audio
                                            </div>
                                            <audio
                                                controls
                                                preload="none"
                                                {...({loading: 'lazy'} as any)}
                                                src={item.url}
                                                className="h-9 w-full"
                                            />
                                        </div>
                                    )}
                                    <div className="text-sm font-black" style={{color: 'var(--navy)'}}>
                                        {item.nama}
                                    </div>
                                    <div className="text-xs font-bold text-slate-400">
                                        {item.jenis === 'image' ? 'Gambar' : 'Suara'} ·{' '}
                                        {Math.max(1, Math.round(item.ukuran_bytes / 1024))} KB
                                    </div>
                                </div>

                                <div className="mt-3 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(item.id)}
                                        className="rounded-lg px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50"
                                    >
                                        Hapus
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-xs">
                <h2 className="mb-1 text-lg font-black" style={{color: 'var(--navy)'}}>
                    Unggah Gambar / Suara
                </h2>
                <p className="mb-4 text-xs font-semibold text-slate-500">
                    Maksimal 10 MB per berkas. Mendukung PNG, JPG, WebP, GIF, MP3, WAV, dan OGG.
                </p>

                <form onSubmit={handleUpload} method="POST" className="space-y-4">
                    <div>
                        <label
                            htmlFor="media-nama"
                            className="mb-1 block text-xs font-extrabold"
                            style={{color: 'var(--navy)'}}
                        >
                            Nama Aset
                        </label>
                        <input
                            id="media-nama"
                            name="nama"
                            type="text"
                            required
                            maxLength={100}
                            value={nama}
                            onChange={e => setNama(e.target.value)}
                            placeholder="Contoh: Musik Hutan / Sprite Bintang"
                            className="w-full rounded-xl border-2 border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900"
                        />
                    </div>
                    <div>
                        <label
                            htmlFor="media-file"
                            className="mb-1 block text-xs font-extrabold"
                            style={{color: 'var(--navy)'}}
                        >
                            Pilih Berkas (Gambar atau Audio)
                        </label>
                        <input
                            id="media-file"
                            name="file"
                            type="file"
                            required
                            accept="image/png,image/jpeg,image/webp,image/gif,audio/mpeg,audio/wav,audio/ogg,audio/webm"
                            className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-xl px-4 py-3 text-sm font-black text-white"
                        style={{background: 'var(--teal)', boxShadow: '0 3px 0 var(--teal-deeper)'}}
                    >
                        {loading ? 'Mengunggah…' : '+ Unggah ke Pustaka'}
                    </button>
                </form>
            </section>
        </div>
    );
}
