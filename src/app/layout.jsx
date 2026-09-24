import { Space_Grotesk, Hanken_Grotesk } from 'next/font/google';
import './globals.css';

// Space Grotesk = display (títulos de card); Hanken Grotesk = corpo.
const display = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});
const body = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata = {
  title: 'USP Debate — Treinos',
  description: 'Sistema de Treinos BP',
};

export const viewport = {
  themeColor: '#161113',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
