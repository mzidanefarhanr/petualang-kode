import Link from 'next/link';
import {notFound} from 'next/navigation';
import {SignOutButton} from '@/components/SignOutButton';
import {StudentLiveRoomClient} from '@/components/StudentLiveRoomClient';
import {getPool} from '@/lib/db';
import {requireStudentPage} from '@/lib/page-auth';
import {getStudentActiveClassLiveSession} from '@/server/live-sessions';

export const dynamic = 'force-dynamic';

export default async function StudentLiveRoomPage({
    params
}: {
    params: Promise<{class_id: string}>;
}) {
    const {class_id} = await params;
    const session = await requireStudentPage(`/kelas/${class_id}/live`);

    let data: Awaited<ReturnType<typeof getStudentActiveClassLiveSession>>;
    try {
        data = await getStudentActiveClassLiveSession(getPool(), session.user.id, class_id);
    } catch {
        notFound();
    }

    return (
        <main className="min-h-screen" style={{background: 'var(--cream)'}}>
            <header className="pk-nav">
                <div className="pk-wrap pk-nav-row">
                    <div className="flex items-center gap-3">
                        <Link href="/kelas" className="pk-nav-logo">
                            Petualang<span>Kode</span>
                        </Link>
                        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold text-white">
                            {data.kelas.nama}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-xs font-extrabold text-white">
                            <img
                                src="/mascot/pose-ui/08-ikon-kepala-avatar.jpg"
                                alt=""
                                className="h-7 w-7 rounded-full border-2 border-white object-cover"
                            />
                            <span>{session.user.name}</span>
                        </div>
                        <SignOutButton />
                    </div>
                </div>
            </header>

            <StudentLiveRoomClient
                classId={data.kelas.id}
                kelasNama={data.kelas.nama}
                studentName={session.user.name || 'Petualang'}
                initialSession={data.session}
            />
        </main>
    );
}
