'use client';

import {useRouter} from 'next/navigation';
import {useState} from 'react';

export interface StudentRow {
    id: string;
    username: string;
    nama: string;
    kelas: Array<{id: string; nama: string}>;
}

export function AdminStudentsClient({
    students,
    classes
}: {
    students: StudentRow[];
    classes: Array<{id: string; nama: string}>;
}) {
    const router = useRouter();
    const [nama, setNama] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [classId, setClassId] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const [resetId, setResetId] = useState<string | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [resetMessage, setResetMessage] = useState('');

    async function handleCreateStudent(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);
        setError('');

        const res = await fetch('/api/v1/admin/students', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                nama,
                username,
                password,
                class_id: classId || undefined
            })
        });
        const data = await res.json().catch(() => ({}));
        setLoading(false);

        if (!res.ok) {
            setError(data?.error?.pesan || 'Gagal membuat akun siswa.');
            return;
        }
        setNama('');
        setUsername('');
        setPassword('');
        setClassId('');
        router.refresh();
    }

    async function handleResetPassword(studentId: string) {
        if (newPassword.length < 4) return;
        const res = await fetch(`/api/v1/admin/students/${studentId}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({password: newPassword})
        });
        if (res.ok) {
            setResetId(null);
            setNewPassword('');
            setResetMessage('Kata sandi siswa berhasil diperbarui.');
            window.setTimeout(() => setResetMessage(''), 3000);
        }
    }

    async function handleArchiveStudent(studentId: string) {
        await fetch(`/api/v1/admin/students/${studentId}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({arsipkan: true})
        });
        router.refresh();
    }

    return (
        <div className="grid gap-8 md:grid-cols-[1.45fr_1fr]">
            <section className="rounded-2xl border-2 border-slate-200 bg-white p-6">
                <h2 className="mb-3 text-lg font-black" style={{color: 'var(--navy)'}}>
                    Daftar Akun Siswa ({students.length})
                </h2>
                {resetMessage && (
                    <p
                        role="status"
                        className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800"
                    >
                        {resetMessage}
                    </p>
                )}
                {students.length === 0 ? (
                    <p className="text-sm font-semibold text-slate-500">
                        Belum ada akun siswa. Buat akun siswa di formulir sebelah kanan.
                    </p>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {students.map(s => (
                            <li key={s.id} className="py-3.5">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <img
                                            src="/mascot/pose-ui/08-ikon-kepala-avatar.jpg"
                                            alt=""
                                            className="h-9 w-9 rounded-full border-2 border-[#1e2d5a] object-cover"
                                        />
                                        <div>
                                            <div
                                                className="text-sm font-black"
                                                style={{color: 'var(--navy)'}}
                                            >
                                                {s.nama}
                                            </div>
                                            <div className="font-mono text-xs font-bold text-slate-500">
                                                Username: <strong>{s.username}</strong>
                                            </div>
                                            {s.kelas.length > 0 && (
                                                <div className="mt-1 flex flex-wrap gap-1.5">
                                                    {s.kelas.map(k => (
                                                        <span
                                                            key={k.id}
                                                            className="rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-extrabold text-teal-900"
                                                        >
                                                            {k.nama}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setResetId(resetId === s.id ? null : s.id);
                                                setNewPassword('');
                                            }}
                                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                                        >
                                            Ubah Sandi
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleArchiveStudent(s.id)}
                                            className="rounded-lg px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50"
                                        >
                                            Arsipkan
                                        </button>
                                    </div>
                                </div>

                                {resetId === s.id && (
                                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 p-2.5">
                                        <label htmlFor={`reset-pw-${s.id}`} className="sr-only">
                                            Sandi Baru
                                        </label>
                                        <input
                                            id={`reset-pw-${s.id}`}
                                            type="text"
                                            minLength={4}
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                            placeholder="Sandi/PIN baru (min. 4 karakter)"
                                            autoComplete="new-password"
                                            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleResetPassword(s.id)}
                                            className="rounded-lg px-3 py-1.5 text-xs font-extrabold text-white"
                                            style={{background: 'var(--teal)'}}
                                        >
                                            Simpan
                                        </button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-xs">
                <h2 className="mb-1 text-lg font-black" style={{color: 'var(--navy)'}}>
                    Buat Akun Login Siswa
                </h2>
                <p className="mb-4 text-xs font-semibold text-slate-500">
                    Siswa tidak dapat mendaftar sendiri. Bagikan username dan kata sandi ini kepada
                    siswa yang bersangkutan.
                </p>

                <form onSubmit={handleCreateStudent} method="POST" className="space-y-3.5">
                    <div>
                        <label
                            htmlFor="student-nama"
                            className="mb-1 block text-xs font-extrabold"
                            style={{color: 'var(--navy)'}}
                        >
                            Nama Lengkap / Panggilan Siswa
                        </label>
                        <input
                            id="student-nama"
                            name="nama"
                            type="text"
                            required
                            value={nama}
                            onChange={e => setNama(e.target.value)}
                            placeholder="Contoh: Siti Aminah"
                            className="w-full rounded-xl border-2 border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-900"
                        />
                    </div>
                    <div>
                        <label
                            htmlFor="student-username"
                            className="mb-1 block text-xs font-extrabold"
                            style={{color: 'var(--navy)'}}
                        >
                            Username (min. 3 karakter)
                        </label>
                        <input
                            id="student-username"
                            name="username"
                            type="text"
                            required
                            minLength={3}
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="none"
                            spellCheck={false}
                            placeholder="contoh: siti01"
                            className="w-full rounded-xl border-2 border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-900"
                        />
                    </div>
                    <div>
                        <label
                            htmlFor="student-password"
                            className="mb-1 block text-xs font-extrabold"
                            style={{color: 'var(--navy)'}}
                        >
                            Kata Sandi / PIN (min. 4 karakter)
                        </label>
                        <input
                            id="student-password"
                            name="password"
                            type="text"
                            required
                            minLength={4}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            autoComplete="new-password"
                            autoCorrect="off"
                            autoCapitalize="none"
                            spellCheck={false}
                            placeholder="contoh: 1234"
                            className="w-full rounded-xl border-2 border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-900"
                        />
                    </div>
                    <div>
                        <label
                            htmlFor="student-class"
                            className="mb-1 block text-xs font-extrabold"
                            style={{color: 'var(--navy)'}}
                        >
                            Masukkan ke Kelas (Opsional)
                        </label>
                        <select
                            id="student-class"
                            name="class_id"
                            value={classId}
                            onChange={e => setClassId(e.target.value)}
                            className="w-full rounded-xl border-2 border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-900"
                        >
                            <option value="">-- Pilih nanti --</option>
                            {classes.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.nama}
                                </option>
                            ))}
                        </select>
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
                        style={{background: 'var(--coral)', boxShadow: '0 3px 0 var(--coral-dark)'}}
                    >
                        {loading ? 'Menyimpan…' : '+ Buat Akun Siswa'}
                    </button>
                </form>
            </section>
        </div>
    );
}
