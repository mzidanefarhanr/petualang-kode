import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import {getPool} from './lib/db';

/*
 * Auth.js (NextAuth) strategi JWT — tanpa tabel sesi di database (DECISIONS D-08).
 * Dua jalur login:
 *   - guru  : email + kata sandi
 *   - murid : username + kata sandi (email opsional)
 * Cookie sesi lintas subdomain memakai COOKIE_DOMAIN dari env.
 */
export const {handlers, auth, signIn, signOut} = NextAuth({
    trustHost: true,
    secret: process.env.AUTH_SECRET,
    session: {strategy: 'jwt'},
    cookies: {
        sessionToken: {
            name: process.env.NODE_ENV === 'production' ? '__Secure-sesi' : 'sesi',
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
                domain: process.env.COOKIE_DOMAIN || undefined
            }
        }
    },
    providers: [
        Credentials({
            id: 'guru',
            name: 'Guru',
            credentials: {
                email: {label: 'Email', type: 'email'},
                password: {label: 'Kata sandi', type: 'password'}
            },
            authorize: async credentials => {
                const email = typeof credentials?.email === 'string' ? credentials.email.trim().toLowerCase() : '';
                const password = typeof credentials?.password === 'string' ? credentials.password : '';
                if (!email || !password) {
                    return null;
                }

                const {rows} = await getPool().query(
                    'select id, nama, password_hash from teachers where lower(email) = $1',
                    [email]
                );
                const teacher = rows[0];
                if (!teacher || !teacher.password_hash) {
                    return null;
                }
                if (!(await bcrypt.compare(password, teacher.password_hash))) {
                    return null;
                }

                return {id: teacher.id, name: teacher.nama, role: 'guru' as const};
            }
        }),
        Credentials({
            id: 'murid',
            name: 'Murid',
            credentials: {
                username: {label: 'Nama pengguna', type: 'text'},
                password: {label: 'Kata sandi', type: 'password'}
            },
            authorize: async credentials => {
                const username = typeof credentials?.username === 'string' ? credentials.username.trim() : '';
                const password = typeof credentials?.password === 'string' ? credentials.password : '';
                if (!username || !password) {
                    return null;
                }

                const {rows} = await getPool().query(
                    'select id, nama, password_hash from students where lower(username) = lower($1)',
                    [username]
                );
                const student = rows[0];
                if (!student || !student.password_hash) {
                    return null;
                }
                if (!(await bcrypt.compare(password, student.password_hash))) {
                    return null;
                }

                return {id: student.id, name: student.nama, role: 'murid' as const};
            }
        })
    ],
    callbacks: {
        jwt({token, user}) {
            if (user) {
                token.uid = user.id;
                token.role = user.role;
            }
            return token;
        },
        session({session, token}) {
            if (session.user) {
                session.user.id = token.uid as string;
                session.user.role = token.role as 'guru' | 'murid';
            }
            return session;
        }
    }
});
