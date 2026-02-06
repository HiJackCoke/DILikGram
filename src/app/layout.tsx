import type { Metadata } from 'next';
import '@/styles/index.css';

export const metadata: Metadata = {
  title: 'DILikGram - Visual Workflow Builder | Portfolio Project',
  description: 'AI-powered workflow builder with real-time execution, version control, and dynamic branching. Built with React, Next.js, and TypeScript.',
  keywords: ['workflow builder', 'visual programming', 'AI automation', 'React', 'Next.js', 'portfolio'],
  openGraph: {
    title: 'DILikGram - Visual Workflow Builder',
    description: 'Build workflows that work. AI-powered automation with real-time visualization.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
