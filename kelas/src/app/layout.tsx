import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Scratch Kelas',
    description: 'Platform pembelajaran Scratch untuk kelas'
};

export default function RootLayout({children}: {children: React.ReactNode}) {
    return (
        <html lang="id">
            <body>{children}</body>
        </html>
    );
}
