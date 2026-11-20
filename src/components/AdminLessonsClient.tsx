'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useState} from 'react';

export interface LessonListItem {
    id: string;
    judul: string;
    deskripsi: string | null;
    jumlah_stage: number;
}

export function AdminLessonsClient({initialLessons}: {initialLessons: LessonListItem[]}) {
    const router = useRouter();
    const [judul, setJudul] = useState('');
    const [deskripsi, setDeskripsi] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleCreateLesson(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);
        setError('');

        const res = await fetch('/api/v1/admin/lessons', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({judul, deskripsi})
        });
        const data = await res.json().catch(() => ({}));
        setLoading(false);

        if (!res.ok) {
            setError(data?.error?.pesan || 'Gagal membuat pelajaran.');
            return;
        }
        setJudul('');
        setDeskripsi('');
        router.push(`/admin/pelajaran/${data.lesson.id}`);
        router.refresh();
    }

    async function handleDeleteLesson(id: string) {
        await fetch(`/api/v1/admin/lessons/${id}`, {method: 'DELETE'});
        router.refresh();
    }

    return (
        <div className="grid gap-8 md:grid-cols-[1.5fr_1fr]">
            <section>
                <h2 className="mb-3 text-lg font-black" style={{color: 'var(--navy)'}}>
                    Daftar Pelajaran ({initialLessons.length})
                </h2>
                {initialLessons.length === 0 ? (
                    <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 text-sm font-semibold text-slate-600">
                        Belum ada pelajaran. Buat pelajaran pertamamu di samping, lalu tambahkan
                        Stage Cerita dan Stage Challenge.
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {initialLessons.map(item => (
                            <li
                                key={item.id}
                                className="rounded-2xl border-2 border-slate-200 bg-white p-5 transition hover:border-[#04a5ad]"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <Link
                                            href={`/admin/pelajaran/${item.id}`}
                                            className="text-lg font-black hover:underline"
                                            style={{color: 'var(--navy)'}}
                                        >
                                            {item.judul}
                                        </Link>
                                        {item.deskripsi && (
                                            <p className="mt-0.5 text-xs font-semibold text-slate-500">
                                                {item.deskripsi}
                                            </p>
                                        )}
                                        <div className="mt-2">
                                            <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-extrabold text-teal-900">
                                                {item.jumlah_stage} stage
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Link
                                            href={`/admin/pelajaran/${item.id}`}
                                            className="rounded-xl px-4 py-2 text-xs font-extrabold text-white"
                                            style={{background: 'var(--navy)'}}
                                        >
                                            Susun Stage →
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteLesson(item.id)}
                                            className="rounded-xl px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50"
                                        >
                                            Hapus
                                        </button>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-xs">
                <h2 className="mb-1 text-lg font-black" style={{color: 'var(--navy)'}}>
                    Buat Pelajaran Baru
                </h2>
                <p className="mb-4 text-xs font-semibold text-slate-500">
                    Satu pelajaran terdiri dari urutan Stage Cerita dan Stage Challenge.
                </p>

                <form onSubmit={handleCreateLesson} method="POST" className="space-y-4">
                    <div>
                        <label
                            htmlFor="lesson-judul"
                            className="mb-1 block text-xs font-extrabold"
                            style={{color: 'var(--navy)'}}
                        >
                            Judul Pelajaran
                        </label>
                        <input
                            id="lesson-judul"
                            name="judul"
                            type="text"
                            required
                            maxLength={120}
                            value={judul}
                            onChange={e => setJudul(e.target.value)}
                            placeholder="Contoh: Misi 1 — Menyeberangi Hutan Kode"
                            className="w-full rounded-xl border-2 border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900"
                        />
                    </div>
                    <div>
                        <label
                            htmlFor="lesson-deskripsi"
                            className="mb-1 block text-xs font-extrabold"
                            style={{color: 'var(--navy)'}}
                        >
                            Deskripsi Singkat (Opsional)
                        </label>
                        <input
                            id="lesson-deskripsi"
                            name="deskripsi"
                            type="text"
                            maxLength={240}
                            value={deskripsi}
                            onChange={e => setDeskripsi(e.target.value)}
                            placeholder="Contoh: Pengenalan langkah berurutan dan belokan"
                            className="w-full rounded-xl border-2 border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900"
                        />
                    </div>

                    {error && (
                        <p
                            role="status"
                            className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700"
                        >
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-xl px-4 py-3 text-sm font-black text-white"
                        style={{background: 'var(--teal)', boxShadow: '0 3px 0 var(--teal-deeper)'}}
                    >
                        {loading ? 'Menyimpan…' : '+ Buat Pelajaran'}
                    </button>
                </form>
            </section>
        </div>
    );
}
