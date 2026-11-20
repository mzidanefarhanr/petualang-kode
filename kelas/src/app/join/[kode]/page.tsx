import {getInviteInfo} from '@/server/invites';
import {getPool} from '@/lib/db';
import {JoinForm} from '@/components/JoinForm';
import {Waktu} from '@/components/Waktu';

function Pesan({judul, isi}: {judul: string; isi: string}) {
    return (
        <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
            <div className="rounded-md border border-slate-200 bg-white p-6">
                <h1 className="text-lg font-semibold text-slate-800">{judul}</h1>
                <p className="mt-2 text-sm text-slate-600">{isi}</p>
            </div>
        </main>
    );
}

export default async function JoinPage({params}: {params: Promise<{kode: string}>}) {
    const {kode} = await params;

    let info = null;
    try {
        info = await getInviteInfo(getPool(), kode);
    } catch {
        info = null;
    }

    if (!info) {
        return (
            <Pesan
                judul="Undangan tidak ditemukan"
                isi="Tautan undangan ini tidak dikenali. Minta tautan baru ke gurumu ya."
            />
        );
    }

    if (info.status !== 'berlaku') {
        return (
            <Pesan
                judul="Undangan sudah tidak berlaku"
                isi={`Tautan undangan ini sudah tidak berlaku. Minta tautan baru ke ${info.kelas.guru}.`}
            />
        );
    }

    return (
        <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
            <div className="rounded-md border border-slate-200 bg-white p-6">
                <h1 className="text-lg text-slate-800">
                    Kamu diundang ke kelas{' '}
                    <span className="font-semibold text-blue-900">{info.kelas.nama}</span> oleh{' '}
                    <span className="font-semibold">{info.kelas.guru}</span>.
                </h1>
                <p className="mb-4 mt-2 text-sm text-slate-600">
                    Isi namamu, nama pengguna, dan kata sandimu untuk mulai. Tautan berlaku sampai{' '}
                    <Waktu iso={info.berlaku_sampai.toISOString()} />.
                </p>
                <JoinForm kode={kode} />
            </div>
        </main>
    );
}
