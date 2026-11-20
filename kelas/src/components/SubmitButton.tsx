'use client';

import {useFormStatus} from 'react-dom';

export function SubmitButton({
    children,
    pendingLabel = 'Memproses...',
    variant = 'primary'
}: {
    children: React.ReactNode;
    pendingLabel?: string;
    variant?: 'primary' | 'secondary';
}) {
    const {pending} = useFormStatus();
    const base = 'rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60';
    const style =
        variant === 'primary'
            ? 'bg-blue-900 text-white hover:bg-blue-800'
            : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50';

    return (
        <button type="submit" disabled={pending} className={`${base} ${style}`}>
            {pending ? pendingLabel : children}
        </button>
    );
}
