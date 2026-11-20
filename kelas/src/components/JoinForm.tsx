'use client';

import {useState} from 'react';
import {signIn} from 'next-auth/react';
import {useRouter} from 'next/navigation';

const inputClass = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm';

const readCookie = (name: string): string => {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[1]) : '';
};

function friendly(kode: string | undefined): string {
    switch (kode) {
        case 'UNDANGAN_KEDALUWARSA':
        case 'UNDANGAN_DICABUT':
        case 'UNDANGAN_PENUH':
        case 'UNDANGAN_TIDAK_VALID':
            return 'Tautan undangan ini sudah tidak berlaku. Minta tautan baru ke gurumu.';
        case 'USERNAME_SUDAH_DIPAKAI':
            return 'Nama pengguna ini sudah dipakai. Coba nama pengguna lain.';
        case 'EMAIL_SUDAH_DIPAKAI':
            return 'Email ini sudah dipakai murid lain. Coba tanpa email atau email lain.';
        case 'KELAS_PENUH':
            return 'Kelas ini sudah penuh. Beri tahu gurumu ya.';
        case 'PERMINTAAN_TIDAK_VALID':
            return 'Periksa lagi isianmu. Nama pengguna minimal 3 huruf, kata sandi minimal 6 huruf.';
        default:
            return 'Pendaftaran belum berhasil. Coba lagi ya.';
    }
}

export function JoinForm({kode}: {kode: string}) {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);
        setError('');
        const data = new FormData(event.currentTarget);
        const payload = {
            nama: data.get('nama'),
            username: data.get('username'),
            email: data.get('email') || '',
            password: data.get('password')
        };

        try {
            const response = await fetch(`/api/v1/invites/${encodeURIComponent(kode)}/join`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': readCookie('csrf_token')
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const body = await response.json().catch(() => null);
                setError(friendly(body?.error?.kode));
                setLoading(false);
                return;
            }

            await signIn('murid', {
                username: String(payload.username),
                password: String(payload.password),
                redirect: false
            });
            router.push('/tugas');
            router.refresh();
        } catch {
            setError('Tidak bisa menyambung. Periksa internetmu, lalu coba lagi.');
            setLoading(false);
        }
    }

    return (
        <form onSubmit={onSubmit} className="space-y-3">
            <label className="block">
                <span className="mb-1 block text-sm text-slate-700">Nama lengkap / nama panggilan</span>
                <input name="nama" type="text" required className={inputClass} />
            </label>
            <label className="block">
                <span className="mb-1 block text-sm text-slate-700">Nama pengguna</span>
                <input name="username" type="text" required minLength={3} className={inputClass} />
                <span className="mt-1 block text-xs text-slate-500">
                    Dipakai untuk masuk lagi di hari lain. Minimal 3 huruf.
                </span>
            </label>
            <label className="block">
                <span className="mb-1 block text-sm text-slate-700">Email (boleh dikosongkan)</span>
                <input name="email" type="email" className={inputClass} />
            </label>
            <label className="block">
                <span className="mb-1 block text-sm text-slate-700">Kata sandi</span>
                <input name="password" type="password" required minLength={6} className={inputClass} />
                <span className="mt-1 block text-xs text-slate-500">Minimal 6 huruf.</span>
            </label>

            {error && <p className="text-sm text-red-700">{error}</p>}

            <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
            >
                {loading ? 'Mendaftarkan...' : 'Mulai belajar'}
            </button>
        </form>
    );
}
