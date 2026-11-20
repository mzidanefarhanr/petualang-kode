'use client';

import {useState} from 'react';
import {signIn} from 'next-auth/react';
import {useRouter} from 'next/navigation';

const inputClass = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm';

export function LoginForm() {
    const [tab, setTab] = useState<'murid' | 'guru'>('murid');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);
        setError('');
        const data = new FormData(event.currentTarget);

        const result =
            tab === 'guru'
                ? await signIn('guru', {
                      email: data.get('email'),
                      password: data.get('password'),
                      redirect: false
                  })
                : await signIn('murid', {
                      username: data.get('username'),
                      password: data.get('password'),
                      redirect: false
                  });

        setLoading(false);
        if (!result || result.error) {
            setError(
                tab === 'guru'
                    ? 'Email atau kata sandi salah. Coba lagi ya.'
                    : 'Nama pengguna atau kata sandi salah. Coba lagi ya.'
            );
            return;
        }
        router.push(tab === 'guru' ? '/guru' : '/tugas');
        router.refresh();
    }

    const tabClass = (value: 'murid' | 'guru') =>
        `flex-1 rounded-md px-3 py-2 text-sm font-medium ${
            tab === value ? 'bg-blue-900 text-white' : 'bg-white text-slate-600 border border-slate-300'
        }`;

    return (
        <div>
            <div className="mb-4 flex gap-2">
                <button type="button" className={tabClass('murid')} onClick={() => setTab('murid')}>
                    Murid
                </button>
                <button type="button" className={tabClass('guru')} onClick={() => setTab('guru')}>
                    Guru
                </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
                {tab === 'guru' ? (
                    <label className="block">
                        <span className="mb-1 block text-sm text-slate-700">Email</span>
                        <input name="email" type="email" required className={inputClass} />
                    </label>
                ) : (
                    <label className="block">
                        <span className="mb-1 block text-sm text-slate-700">Nama pengguna</span>
                        <input name="username" type="text" required className={inputClass} />
                    </label>
                )}

                <label className="block">
                    <span className="mb-1 block text-sm text-slate-700">Kata sandi</span>
                    <input name="password" type="password" required className={inputClass} />
                </label>

                {error && <p className="text-sm text-red-700">{error}</p>}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
                >
                    {loading ? 'Membuka...' : 'Masuk'}
                </button>
            </form>
        </div>
    );
}
