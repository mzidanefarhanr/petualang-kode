import type {DefaultSession} from 'next-auth';

declare module 'next-auth' {
    interface Session {
        user: {
            id: string;
            role: 'guru' | 'murid';
        } & DefaultSession['user'];
    }

    interface User {
        role?: 'guru' | 'murid';
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        uid?: string;
        role?: 'guru' | 'murid';
    }
}
