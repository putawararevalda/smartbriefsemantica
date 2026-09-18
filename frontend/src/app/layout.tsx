import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SmartBrief - AI Article Summarizer & Knowledge Graph',
  description: 'AI-powered article summarizer with Oxigraph knowledge graph extraction and Semantica provenance flashcards.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900 font-sans">
        {children}
      </body>
    </html>
  );
}
