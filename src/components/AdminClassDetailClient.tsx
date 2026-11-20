'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useState} from 'react';

export interface ClassMemberRow {
    id: string;
    nama: string;
    username: string;
    bergabung_pada: string;
}

export interface ClassInviteRow {
    id: string;
    kode: string;
    berlaku_sampai: string;
    dicabut_pada: string | null;
    aktif: boolean;
}

export function AdminClassDetailClient({
    classId,
    kelasNama,
    members,
    invites,
    allStudents,
    lessons = [],
    activeSessionId = null
}: {
    classId: string;
    kelasNama: string;
    members: ClassMemberRow[];
    invites: ClassInviteRow[];
    allStudents: Array<{id: string; nama: string; username: string}>;
    lessons?: Array<{id: string; judul: string; jumlah_stage: number}>;
    activeSessionId?: string | null;
}) {
    const router = useRouter();
    const [selectedLessonId, setSelectedLessonId] = useState(
        lessons.find(l => l.jumlah_stage > 0)?.id || lessons[0]?.id || ''
    );
    const [liveError, setLiveError] = useState('');
    const [liveLoading, setLiveLoading] = useState(false);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [berlakuJam, setBerlakuJam] = useState('168');
    const [inviteError, setInviteError] = useState('');
    const [inviteLoading, setInviteLoading] = useState(false);

    // Tambah siswa baru langsung ke kelas
    const [nama, setNama] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [studentError, setStudentError] = useState('');
    const [studentLoading, setStudentLoading] = useState(false);

    // Masukkan siswa yang sudah ada ke kelas
    const [selectedStudentId, setSelectedStudentId] = useState('');

    const memberIds = new Set(members.map(m => m.id));
    const availableStudents = allStudents.filter(s => !memberIds.has(s.id));

    async function handleCreateInvite(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setInviteLoading(true);
        setInviteError('');

        const res = await fetch(`/api/v1/admin/classes/${classId}/invites`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({berlaku_jam: Number(berlakuJam)})
        });
        const data = await res.json().catch(() => ({}));
        setInviteLoading(false);

        if (!res.ok) {
            setInviteError(data?.error?.pesan || 'Gagal membuat kode undangan.');
            return;
        }
        router.refresh();
    }

    async function handleRevokeInvite(inviteId: string) {
        await fetch(`/api/v1/admin/invites/${inviteId}`, {method: 'DELETE'});
        router.refresh();
    }

    async function handleCopyInvite(kode: string) {
        const url = `${window.location.origin}/join/${kode}`;
        await navigator.clipboard?.writeText(url);
        setCopiedCode(kode);
        window.setTimeout(() => setCopiedCode(null), 2000);
    }

    async function handleCreateStudentInClass(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setStudentLoading(true);
        setStudentError('');

        const res = await fetch('/api/v1/admin/students', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({nama, username, password, class_id: classId})
        });
        const data = await res.json().catch(() => ({}));
        setStudentLoading(false);

        if (!res.ok) {
            setStudentError(data?.error?.pesan || 'Gagal membuat akun siswa.');
            return;
        }
        setNama('');
        setUsername('');
        setPassword('');
        router.refresh();
    }

    async function handleAddExistingStudent(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!selectedStudentId) return;

        await fetch(`/api/v1/admin/classes/${classId}/members`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({student_id: selectedStudentId})
        });
        setSelectedStudentId('');
        router.refresh();
    }

    async function handleRemoveMember(studentId: string) {
        await fetch(`/api/v1/admin/classes/${classId}/members/${studentId}`, {
            method: 'DELETE'
        });
        router.refresh();
    }

    async function handleArchiveClass() {
        await fetch(`/api/v1/admin/classes/${classId}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({arsipkan: true})
        });
        router.push('/admin');
        router.refresh();
    }

    async function handleStartLiveSession(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!selectedLessonId) return;
        setLiveLoading(true);
        setLiveError('');

        const res = await fetch('/api/v1/admin/live-sessions', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({class_id: classId, lesson_id: selectedLessonId})
        });
        const data = await res.json().catch(() => ({}));
        setLiveLoading(false);

        if (!res.ok) {
            if (data?.error?.detail?.session_id) {
                router.push(`/admin/live/${data.error.detail.session_id}`);
                return;
            }
            setLiveError(data?.error?.pesan || 'Gagal memulai sesi live.');
            return;
        }
        router.push(`/admin/live/${data.session.session_id}`);
    }

    return (
        <div className="space-y-8">
            {/* BAGIAN 0: SESI PEMBELAJARAN LIVE */}
            <section
                className="rounded-2xl border-2 p-6 text-white shadow-sm"
                style={{background: 'var(--navy)', borderColor: '#111a38'}}
            >
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <span
                            className="inline-block rounded-full px-3 py-0.5 text-xs font-black uppercase text-slate-900"
                            style={{background: 'var(--amber)'}}
                        >
                            Kontrol Layar Kelas Live (Maks. 20 Siswa)
                        </span>
                        <h2 className="mt-1.5 text-xl font-black">
                            {activeSessionId
                                ? 'Sesi Live Sedang Berlangsung!'
                                : `Mulai Sesi Live untuk ${kelasNama}`}
                        </h2>
                        <p className="mt-0.5 text-xs font-semibold text-white/75">
                            Saat sesi live dimulai, layar seluruh siswa di kelas ini akan otomatis
                            terkunci mengikuti stage yang Anda pilih.
                        </p>
                    </div>

                    {activeSessionId ? (
                        <Link
                            href={`/admin/live/${activeSessionId}`}
                            className="rounded-xl px-5 py-3 text-sm font-black text-white"
                            style={{background: 'var(--teal)', boxShadow: '0 3px 0 var(--teal-deeper)'}}
                        >
                            Buka Panel Kontrol Live →
                        </Link>
                    ) : (
                        <form
                            onSubmit={handleStartLiveSession}
                            method="POST"
                            className="flex flex-wrap items-center gap-2.5"
                        >
                            <label htmlFor="live-lesson-select" className="sr-only">
                                Pilih Pelajaran
                            </label>
                            <select
                                id="live-lesson-select"
                                value={selectedLessonId}
                                onChange={e => setSelectedLessonId(e.target.value)}
                                className="rounded-xl border-2 border-white/20 bg-white px-3.5 py-2.5 text-xs font-extrabold text-slate-900"
                            >
                                {lessons.length === 0 ? (
                                    <option value="">-- Belum ada pelajaran --</option>
                                ) : (
                                    lessons.map(l => (
                                        <option key={l.id} value={l.id}>
                                            {l.judul} ({l.jumlah_stage} stage)
                                        </option>
                                    ))
                                )}
                            </select>
                            <button
                                type="submit"
                                disabled={liveLoading || !selectedLessonId}
                                className="rounded-xl px-5 py-2.5 text-xs font-black text-white"
                                style={{
                                    background: 'var(--coral)',
                                    boxShadow: '0 3px 0 var(--coral-dark)'
                                }}
                            >
                                {liveLoading ? 'Memulai…' : '🚀 Mulai Sesi Live'}
                            </button>
                        </form>
                    )}
                </div>

                {liveError && (
                    <p
                        role="status"
                        className="mt-3 rounded-xl bg-rose-500/20 px-3.5 py-2 text-xs font-bold text-rose-200"
                    >
                        {liveError}
                    </p>
                )}
            </section>
            {/* BAGIAN 1: KODE INVITE CLASS */}
            <section className="rounded-2xl border-2 border-slate-200 bg-white p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-black" style={{color: 'var(--navy)'}}>
                            Kode &amp; Tautan Invite Class
                        </h2>
                        <p className="text-xs font-semibold text-slate-500">
                            Bagikan kode atau tautan ini kepada siswa di kelas <strong>{kelasNama}</strong>.
                        </p>
                    </div>

                    <form onSubmit={handleCreateInvite} method="POST" className="flex items-center gap-2">
                        <label htmlFor="invite-duration" className="text-xs font-extrabold text-slate-600">
                            Masa berlaku:
                        </label>
                        <select
                            id="invite-duration"
                            name="berlaku_jam"
                            value={berlakuJam}
                            onChange={e => setBerlakuJam(e.target.value)}
                            className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900"
                        >
                            <option value="24">1 Hari (24 jam)</option>
                            <option value="168">7 Hari</option>
                            <option value="720">30 Hari</option>
                        </select>
                        <button
                            type="submit"
                            disabled={inviteLoading}
                            className="rounded-xl px-4 py-2 text-xs font-black text-white"
                            style={{background: 'var(--teal)', boxShadow: '0 2px 0 var(--teal-deeper)'}}
                        >
                            {inviteLoading ? 'Membuat…' : '+ Buat Kode Undangan'}
                        </button>
                    </form>
                </div>

                {inviteError && (
                    <p role="status" className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                        {inviteError}
                    </p>
                )}

                {invites.length === 0 ? (
                    <p className="text-xs font-semibold text-slate-500">
                        Belum ada kode undangan untuk kelas ini.
                    </p>
                ) : (
                    <ul className="space-y-2.5">
                        {invites.map(inv => (
                            <li
                                key={inv.id}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3"
                            >
                                <div className="flex flex-wrap items-center gap-3">
                                    <span
                                        className="rounded-lg px-3 py-1 font-mono text-sm font-black tracking-wider text-white"
                                        style={{background: inv.aktif ? 'var(--navy)' : '#94a3b8'}}
                                    >
                                        {inv.kode}
                                    </span>
                                    <span
                                        className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                                            inv.aktif
                                                ? 'bg-emerald-100 text-emerald-900'
                                                : 'bg-slate-200 text-slate-600'
                                        }`}
                                    >
                                        {inv.aktif
                                            ? 'Aktif'
                                            : inv.dicabut_pada
                                              ? 'Dicabut'
                                              : 'Kedaluwarsa'}
                                    </span>
                                    <span className="text-xs font-semibold text-slate-500">
                                        s.d. {new Date(inv.berlaku_sampai).toLocaleString('id-ID')}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    {inv.aktif && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => handleCopyInvite(inv.kode)}
                                                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-100"
                                            >
                                                {copiedCode === inv.kode ? 'Tersalin ✓' : 'Salin Tautan /join/' + inv.kode}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleRevokeInvite(inv.id)}
                                                className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-extrabold text-rose-700 hover:bg-rose-100"
                                            >
                                                Cabut
                                            </button>
                                        </>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {/* BAGIAN 2: ANGGOTA SISWA & BUAT AKUN SISWA */}
            <div className="grid gap-8 md:grid-cols-[1.35fr_1fr]">
                <section className="rounded-2xl border-2 border-slate-200 bg-white p-6">
                    <h2 className="mb-3 text-lg font-black" style={{color: 'var(--navy)'}}>
                        Siswa Terdaftar di Kelas ({members.length})
                    </h2>
                    {members.length === 0 ? (
                        <p className="text-sm font-semibold text-slate-500">
                            Belum ada siswa di kelas ini. Buat akun siswa baru atau tambahkan siswa
                            di formulir sebelah kanan.
                        </p>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {members.map(student => (
                                <li
                                    key={student.id}
                                    className="flex items-center justify-between gap-3 py-3"
                                >
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
                                                {student.nama}
                                            </div>
                                            <div className="font-mono text-xs font-bold text-slate-500">
                                                @{student.username}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveMember(student.id)}
                                        className="rounded-lg px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50"
                                    >
                                        Keluarkan
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <div className="space-y-6">
                    <section className="rounded-2xl border-2 border-slate-200 bg-white p-6">
                        <h3 className="mb-1 text-base font-black" style={{color: 'var(--navy)'}}>
                            Buat Akun Siswa Baru ke Kelas Ini
                        </h3>
                        <p className="mb-4 text-xs font-semibold text-slate-500">
                            Hanya Admin yang dapat membuat akun login siswa.
                        </p>

                        <form onSubmit={handleCreateStudentInClass} method="POST" className="space-y-3">
                            <div>
                                <label
                                    htmlFor="new-student-nama"
                                    className="mb-1 block text-xs font-extrabold"
                                    style={{color: 'var(--navy)'}}
                                >
                                    Nama Siswa
                                </label>
                                <input
                                    id="new-student-nama"
                                    name="nama"
                                    type="text"
                                    required
                                    value={nama}
                                    onChange={e => setNama(e.target.value)}
                                    placeholder="Contoh: Budi Santoso"
                                    className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900"
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="new-student-username"
                                    className="mb-1 block text-xs font-extrabold"
                                    style={{color: 'var(--navy)'}}
                                >
                                    Username Login (min. 3 karakter)
                                </label>
                                <input
                                    id="new-student-username"
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
                                    placeholder="contoh: budi5a"
                                    className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900"
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="new-student-password"
                                    className="mb-1 block text-xs font-extrabold"
                                    style={{color: 'var(--navy)'}}
                                >
                                    Kata Sandi / PIN (min. 4 karakter)
                                </label>
                                <input
                                    id="new-student-password"
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
                                    className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900"
                                />
                            </div>

                            {studentError && (
                                <p
                                    role="status"
                                    className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700"
                                >
                                    {studentError}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={studentLoading}
                                className="w-full rounded-xl px-4 py-2.5 text-sm font-black text-white"
                                style={{
                                    background: 'var(--coral)',
                                    boxShadow: '0 3px 0 var(--coral-dark)'
                                }}
                            >
                                {studentLoading ? 'Menyimpan…' : '+ Buat & Masukkan ke Kelas'}
                            </button>
                        </form>
                    </section>

                    {availableStudents.length > 0 && (
                        <section className="rounded-2xl border-2 border-slate-200 bg-white p-6">
                            <h3
                                className="mb-2 text-sm font-black"
                                style={{color: 'var(--navy)'}}
                            >
                                Tambahkan Siswa yang Sudah Ada
                            </h3>
                            <form
                                onSubmit={handleAddExistingStudent}
                                method="POST"
                                className="flex gap-2"
                            >
                                <label htmlFor="existing-student-select" className="sr-only">
                                    Pilih Siswa
                                </label>
                                <select
                                    id="existing-student-select"
                                    name="student_id"
                                    value={selectedStudentId}
                                    onChange={e => setSelectedStudentId(e.target.value)}
                                    className="flex-1 rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900"
                                >
                                    <option value="">-- Pilih siswa --</option>
                                    {availableStudents.map(s => (
                                        <option key={s.id} value={s.id}>
                                            {s.nama} (@{s.username})
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="submit"
                                    className="rounded-xl px-4 py-2 text-xs font-black text-white"
                                    style={{background: 'var(--navy)'}}
                                >
                                    Tambahkan
                                </button>
                            </form>
                        </section>
                    )}

                    <div className="text-right">
                        <button
                            type="button"
                            onClick={handleArchiveClass}
                            className="text-xs font-bold text-slate-400 hover:text-rose-600"
                        >
                            Arsipkan kelas ini
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
