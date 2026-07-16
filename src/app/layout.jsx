import { Space_Grotesk, Hanken_Grotesk } from 'next/font/google';
import './globals.css';

// Fontes com caráter, não-genéricas (substituem Alteix Sans / Arena).
// Space Grotesk = display; Hanken Grotesk = corpo. Nada de Inter/Roboto/Arial.
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
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
