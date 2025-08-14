import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ padding: 32 }}>
      <h1 style={{ marginBottom: 8 }}>Hallo, Vercel! 👋</h1>
      <p style={{ marginBottom: 16 }}>Dieses Next.js-Projekt ist sofort deploybar.</p>
      <ul>
        <li><Link href="/hello">/hello</Link></li>
      </ul>
    </main>
  );
}
