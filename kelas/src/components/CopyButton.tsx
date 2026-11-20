'use client';

import {useState} from 'react';

export function CopyButton({value, label = 'Salin tautan'}: {value: string; label?: string}) {
    const [copied, setCopied] = useState(false);

    async function onClick() {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            window.prompt('Salin tautan ini:', value);
        }
    }

    return (
        <button
            type="button"
            onClick={onClick}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
            {copied ? 'Tersalin' : label}
        </button>
    );
}
