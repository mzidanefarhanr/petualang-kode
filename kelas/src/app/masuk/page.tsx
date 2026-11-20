import {LoginForm} from '@/components/LoginForm';

export default function MasukPage() {
    return (
        <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
            <h1 className="text-2xl font-semibold text-blue-900">Scratch Kelas</h1>
            <p className="mb-6 mt-1 text-sm text-slate-600">Masuk untuk mulai belajar atau mengajar.</p>
            <div className="rounded-md border border-slate-200 bg-white p-6">
                <LoginForm />
            </div>
        </main>
    );
}
