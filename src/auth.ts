import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import {getPool} from './lib/db';

/*
 * Auth.js (NextAuth) strategi JWT — tanpa tabel sesi di database (DECISIONS D-07).
 * Dua jalur masuk:
 *   - admin   : email + kata sandi
 *   - student : username + kata sandi/PIN (dibuat oleh Admin, tidak diarsipkan)
 */
export const SESSION_COOKIE_NAME = process.env.NODE_ENV === 'production' ? '__Secure-sesi' : 'sesi';

export const {handlers, auth, signIn, signOut} = NextAuth({
    trustHost: true,
    secret: process.env.AUTH_SECRET,
    session: {strategy: 'jwt'},
    cookies: {
        sessionToken: {
            name: SESSION_COOKIE_NAME,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production'
            }
        }
    },
    providers: [
        Credentials({
            id: 'admin',
            name: 'Admin',
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
                    'select id, nama, email, password_hash from admins where lower(email) = $1',
                    [email]
                );
                const admin = rows[0];
                if (!admin || !admin.password_hash) {
                    return null;
                }
                if (!(await bcrypt.compare(password, admin.password_hash))) {
                    return null;
                }

                return {
                    id: admin.id,
                    name: admin.nama,
                    email: admin.email,
                    role: 'admin' as const
                };
            }
        }),
        Credentials({
            id: 'student',
            name: 'Siswa',
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
                    `select id, nama, username, password_hash
                     from students
                     where lower(username) = lower($1)
                       and diarsipkan_pada is null`,
                    [username]
                );
                const student = rows[0];
                if (!student || !student.password_hash) {
                    return null;
                }
                if (!(await bcrypt.compare(password, student.password_hash))) {
                    return null;
                }

                return {
                    id: student.id,
                    name: student.nama,
                    username: student.username,
                    role: 'student' as const
                };
            }
        })
    ],
    callbacks: {
        jwt({token, user}) {
            if (user) {
                token.uid = user.id;
                token.role = user.role;
                if (user.username) {
                    token.username = user.username;
                }
            }
            return token;
        },
        session({session, token}) {
            if (session.user) {
                session.user.id = token.uid as string;
                session.user.role = token.role as 'admin' | 'student';
                if (typeof token.username === 'string') {
                    session.user.username = token.username;
                }
            }
            return session;
        }
    }
});
