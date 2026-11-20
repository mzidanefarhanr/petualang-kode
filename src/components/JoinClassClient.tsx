'use client';

import {useState} from 'react';
import {signIn} from 'next-auth/react';
import {useRouter} from 'next/navigation';

export function JoinClassClient({
    kode,
    kelasNama,
    adminNama,
    currentRole,
    currentStudentName
}: {
    kode: string;
    kelasNama: string;
    adminNama: string;
    currentRole?: 'admin' | 'student';
    currentStudentName?: string | null;
}) {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function completeJoin() {
        const res = await fetch(`/api/v1/invites/${encodeURIComponent(kode)}`, {
            method: 'POST'
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            setError(data?.error?.pesan || 'Tidak dapat masuk ke kelas ini.');
            setLoading(false);
            return;
        }
        router.push(`/kelas/${data.joined.class_id}/live`);
        router.refresh();
    }

    async function handleStudentLoginAndJoin(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);
        setError('');
        const formData = new FormData(event.currentTarget);

        const loginResult = await signIn('student', {
            username: String(formData.get('username') || ''),
            password: String(formData.get('password') || ''),
            redirect: false
        });

        if (!loginResult || loginResult.error) {
            setLoading(false);
            setError('Nama pengguna atau kata sandi salah. Coba tanya ke gurumu ya.');
            return;
        }

        await completeJoin();
    }

    async function handleDirectJoin() {
        setLoading(true);
        setError('');
        await completeJoin();
    }

    if (currentRole === 'student') {
        return (
            <div className="space-y-4">
                <div className="rounded-2xl bg-teal-50 p-4 text-sm font-bold text-teal-950">
                    Halo, <strong>{currentStudentName}</strong>! Kamu siap masuk ke kelas{' '}
                    <strong>{kelasNama}</strong> bersama <strong>{adminNama}</strong>.
                </div>
                {error && (
                    <p
                        role="status"
                        aria-live="polite"
                        className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm font-bold text-rose-700"
                    >
                        {error}
                    </p>
                )}
                <button
                    type="button"
                    disabled={loading}
                    onClick={handleDirectJoin}
                    className="w-full rounded-xl px-5 py-3.5 text-base font-black text-white"
                    style={{background: 'var(--coral)', boxShadow: '0 4px 0 var(--coral-dark)'}}
                >
                    {loading ? 'Memasuki kelas…' : 'Masuk ke Kelas Sekarang →'}
                </button>
            </div>
        );
    }

    return (
        <div>
            <p className="mb-4 text-sm font-bold text-slate-600">
                Masukkan akun siswa yang sudah dibuatkan oleh <strong>{adminNama}</strong> untuk
                bergabung ke kelas <strong>{kelasNama}</strong>.
            </p>
            <form onSubmit={handleStudentLoginAndJoin} method="POST" className="space-y-4">
                <div>
                    <label
                        htmlFor="join-username"
                        className="mb-1 block text-sm font-extrabold"
                        style={{color: 'var(--navy)'}}
                    >
                        Nama Pengguna Siswa
                    </label>
                    <input
                        id="join-username"
                        name="username"
                        type="text"
                        required
                        minLength={3}
                        autoComplete="username"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        enterKeyHint="next"
                        onChange={() => error && setError('')}
                        className="w-full rounded-xl border-2 border-slate-200 bg-white px-3.5 py-2.5 text-base font-bold text-slate-900 focus-visible:border-[#04a5ad] focus-visible:outline-none"
                        placeholder="contoh: kelinci01"
                    />
                </div>
                <div>
                    <label
                        htmlFor="join-password"
                        className="mb-1 block text-sm font-extrabold"
                        style={{color: 'var(--navy)'}}
                    >
                        Kata Sandi / PIN
                    </label>
                    <input
                        id="join-password"
                        name="password"
                        type="password"
                        required
                        autoComplete="current-password"
                        enterKeyHint="done"
                        onChange={() => error && setError('')}
                        className="w-full rounded-xl border-2 border-slate-200 bg-white px-3.5 py-2.5 text-base font-bold text-slate-900 focus-visible:border-[#04a5ad] focus-visible:outline-none"
                    />
                </div>
                {error && (
                    <p
                        role="status"
                        aria-live="polite"
                        className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm font-bold text-rose-700"
                    >
                        {error}
                    </p>
                )}
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl px-5 py-3.5 text-base font-black text-white"
                    style={{background: 'var(--coral)', boxShadow: '0 4px 0 var(--coral-dark)'}}
                >
                    {loading ? 'Memasuki kelas…' : 'Masuk & Gabung Kelas →'}
                </button>
            </form>
        </div>
    );
}
