import type {DefaultSession} from 'next-auth';

declare module 'next-auth' {
    interface User {
        role?: 'admin' | 'student';
        username?: string;
    }

    interface Session {
        user: {
            id: string;
            role: 'admin' | 'student';
            username?: string;
        } & DefaultSession['user'];
    }
}
