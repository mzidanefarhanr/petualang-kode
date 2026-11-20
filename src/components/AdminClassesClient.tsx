'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useState} from 'react';

export interface ClassListItem {
    id: string;
    nama: string;
    deskripsi: string | null;
    jumlah_siswa: number;
    jumlah_undangan_aktif: number;
}

export function AdminClassesClient({initialClasses}: {initialClasses: ClassListItem[]}) {
    const [nama, setNama] = useState('');
    const [deskripsi, setDeskripsi] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function handleCreateClass(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);
        setError('');

        const res = await fetch('/api/v1/admin/classes', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({nama, deskripsi})
        });
        const data = await res.json().catch(() => ({}));
        setLoading(false);

        if (!res.ok) {
            setError(data?.error?.pesan || 'Gagal membuat kelas.');
            return;
        }
        setNama('');
        setDeskripsi('');
        router.refresh();
    }

    return (
        <div className="grid gap-8 md:grid-cols-[1.5fr_1fr]">
            <section>
                <h2 className="mb-3 text-lg font-black" style={{color: 'var(--navy)'}}>
                    Daftar Kelas ({initialClasses.length})
                </h2>
                {initialClasses.length === 0 ? (
                    <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 text-sm font-semibold text-slate-600">
                        Belum ada kelas. Buat kelas pertamamu lewat formulir di samping.
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {initialClasses.map(item => (
                            <li
                                key={item.id}
                                className="rounded-2xl border-2 border-slate-200 bg-white p-5 transition hover:border-[#04a5ad]"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <Link
                                            href={`/admin/kelas/${item.id}`}
                                            className="text-lg font-black hover:underline"
                                            style={{color: 'var(--navy)'}}
                                        >
                                            {item.nama}
                                        </Link>
                                        {item.deskripsi && (
                                            <p className="mt-0.5 text-xs font-semibold text-slate-500">
                                                {item.deskripsi}
                                            </p>
                                        )}
                                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-extrabold">
                                            <span className="rounded-full bg-teal-50 px-3 py-1 text-teal-900">
                                                {item.jumlah_siswa} siswa
                                            </span>
                                            <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-900">
                                                {item.jumlah_undangan_aktif} kode undangan aktif
                                            </span>
                                        </div>
                                    </div>
                                    <Link
                                        href={`/admin/kelas/${item.id}`}
                                        className="rounded-xl px-4 py-2 text-xs font-extrabold text-white"
                                        style={{background: 'var(--navy)'}}
                                    >
                                        Kelola Kelas →
                                    </Link>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-xs">
                <h2 className="mb-1 text-lg font-black" style={{color: 'var(--navy)'}}>
                    Buat Kelas Baru
                </h2>
                <p className="mb-4 text-xs font-semibold text-slate-500">
                    Setiap kelas memiliki daftar siswa dan kode undangan sendiri.
                </p>

                <form onSubmit={handleCreateClass} method="POST" className="space-y-4">
                    <div>
                        <label
                            htmlFor="class-nama"
                            className="mb-1 block text-xs font-extrabold"
                            style={{color: 'var(--navy)'}}
                        >
                            Nama Kelas
                        </label>
                        <input
                            id="class-nama"
                            name="nama"
                            type="text"
                            required
                            maxLength={100}
                            value={nama}
                            onChange={e => {
                                setNama(e.target.value);
                                if (error) setError('');
                            }}
                            placeholder="Contoh: Kelas Coding 5A"
                            className="w-full rounded-xl border-2 border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 focus-visible:border-[#04a5ad] focus-visible:outline-none"
                        />
                    </div>
                    <div>
                        <label
                            htmlFor="class-deskripsi"
                            className="mb-1 block text-xs font-extrabold"
                            style={{color: 'var(--navy)'}}
                        >
                            Keterangan (Opsional)
                        </label>
                        <input
                            id="class-deskripsi"
                            name="deskripsi"
                            type="text"
                            maxLength={200}
                            value={deskripsi}
                            onChange={e => setDeskripsi(e.target.value)}
                            placeholder="Contoh: Jadwal Selasa 14.00"
                            className="w-full rounded-xl border-2 border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 focus-visible:border-[#04a5ad] focus-visible:outline-none"
                        />
                    </div>

                    {error && (
                        <p
                            role="status"
                            aria-live="polite"
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
                        {loading ? 'Menyimpan…' : '+ Buat Kelas'}
                    </button>
                </form>
            </section>
        </div>
    );
}
