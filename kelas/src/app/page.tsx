import {redirect} from 'next/navigation';
import {auth} from '@/auth';

export default async function HomePage() {
    const session = await auth();
    if (session?.user?.role === 'guru') {
        redirect('/guru');
    }
    if (session?.user?.role === 'murid') {
        redirect('/tugas');
    }
    redirect('/masuk');
}
