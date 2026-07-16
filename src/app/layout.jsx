import { Hanken_Grotesk, IBM_Plex_Serif, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import './design-tokens-modern.css';

// Tipografia do design system Modern (editorial):
// IBM Plex Serif = display; Hanken Grotesk = corpo; JetBrains Mono = rótulos/números.
const display = IBM_Plex_Serif({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});
const body = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});
const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata = {
  title: 'USP Debate — Treinos',
  description: 'Sistema de Treinos BP',
};

export const viewport = {
  themeColor: '#121016',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
