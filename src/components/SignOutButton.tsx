'use client';

import {signOut} from 'next-auth/react';

export function SignOutButton() {
    return (
        <button
            type="button"
            onClick={() => signOut({callbackUrl: '/'})}
            className="rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-extrabold text-white transition hover:bg-white/25"
        >
            Keluar
        </button>
    );
}
