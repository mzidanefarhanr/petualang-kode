import type {Metadata} from 'next';
import {Nunito} from 'next/font/google';
import './globals.css';

const nunito = Nunito({
    subsets: ['latin'],
    weight: ['400', '600', '700', '800', '900'],
    style: ['normal', 'italic'],
    variable: '--font-nunito',
    display: 'swap'
});

export const metadata: Metadata = {
    title: 'Petualang Kode — Belajar Coding Seru untuk Anak',
    description: 'Platform belajar coding visual interaktif dipandu langsung oleh guru'
};

export default function RootLayout({children}: {children: React.ReactNode}) {
    return (
        <html lang="id" className={nunito.variable}>
            <body>{children}</body>
        </html>
    );
}
