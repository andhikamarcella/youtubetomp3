import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { getServerSession } from 'next-auth/next';
import { signIn, signOut } from 'next-auth/react';
import { useMemo, useState } from 'react';
import { authOptions } from '../lib/next-auth';

type PageUser = { id: string; email: string; name?: string | null; image?: string | null } | null;

type Props = {
  code: string;
  user: PageUser;
};

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const code = String(context.query.code || '').trim().toUpperCase();
  const session = await getServerSession(context.req, context.res, authOptions);
  const sessionUser = session?.user as any;
  return {
    props: {
      code,
      user: sessionUser?.id && sessionUser?.email
        ? { id: sessionUser.id, email: sessionUser.email, name: sessionUser.name || null, image: sessionUser.image || null }
        : null,
    },
  };
};

export default function CliLoginPage({ code: initialCode, user }: Props) {
  const [code, setCode] = useState(initialCode);
  const [state, setState] = useState<'idle' | 'working' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const normalizedCode = useMemo(() => code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8).replace(/(.{4})(?=.)/, '$1-'), [code]);
  const callbackUrl = `/cli-login?code=${encodeURIComponent(normalizedCode)}`;

  async function approve() {
    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalizedCode)) {
      setState('error');
      setMessage('Masukkan kode 8 karakter yang muncul di terminal.');
      return;
    }
    setState('working');
    setMessage('Menghubungkan perangkat…');
    try {
      const response = await fetch('/api/cli-auth/approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userCode: normalizedCode }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Perangkat tidak dapat disetujui.');
      setState('success');
      setMessage('Berhasil! Kembali ke terminal. YTConv akan melanjutkan secara otomatis.');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Login gagal. Coba lagi.');
    }
  }

  return (
    <>
      <Head>
        <title>Login YTConv CLI</title>
        <meta name="description" content="Hubungkan YTConv CLI dengan akun YTConv secara aman." />
      </Head>
      <main className="shell">
        <section className="card">
          <div className="brand">YTCONV</div>
          <p className="eyebrow">SECURE DEVICE LOGIN</p>
          <h1>Hubungkan terminalmu</h1>
          <p className="lead">Masuk sekali lewat browser, lalu unduhan dan konversi di iSH, Termux, Windows, Linux, atau macOS dapat berjalan dengan akun yang sama.</p>

          <label htmlFor="code">Kode perangkat</label>
          <input
            id="code"
            value={normalizedCode}
            onChange={(event) => setCode(event.target.value)}
            placeholder="ABCD-EFGH"
            autoComplete="one-time-code"
            spellCheck={false}
            disabled={state === 'success'}
          />

          {!user ? (
            <button className="primary" onClick={() => signIn('google', { callbackUrl })}>Masuk dengan Google</button>
          ) : (
            <>
              <div className="account">
                {user.image ? <img src={user.image} alt="" /> : <span>{(user.name || user.email).slice(0, 1).toUpperCase()}</span>}
                <div><strong>{user.name || 'Akun YTConv'}</strong><small>{user.email}</small></div>
              </div>
              <button className="primary" disabled={state === 'working' || state === 'success'} onClick={approve}>
                {state === 'working' ? 'Menghubungkan…' : state === 'success' ? 'Perangkat terhubung' : 'Izinkan YTConv CLI'}
              </button>
              <button className="secondary" onClick={() => signOut({ callbackUrl })}>Ganti akun</button>
            </>
          )}

          {message ? <p className={`status ${state}`}>{message}</p> : null}
          <p className="privacy">Token disimpan khusus di perangkat dan dapat dicabut dengan <code>ytconv logout</code>. Jangan bagikan kode perangkat kepada orang lain.</p>
        </section>
      </main>
      <style jsx>{`
        :global(*) { box-sizing: border-box; }
        :global(body) { margin: 0; background: #050505; color: #f7f7f7; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
        .shell { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: radial-gradient(circle at top, #202020 0, #080808 42%, #020202 100%); }
        .card { width: min(100%, 560px); border: 1px solid #777; background: rgba(7,7,7,.94); padding: clamp(24px, 6vw, 44px); box-shadow: 0 24px 90px rgba(0,0,0,.65); }
        .brand { font-size: clamp(38px, 10vw, 72px); line-height: .9; letter-spacing: -.08em; font-weight: 900; }
        .eyebrow { color: #aaa; letter-spacing: .16em; font-size: 12px; margin: 18px 0 8px; }
        h1 { font: inherit; font-weight: 800; font-size: clamp(25px, 6vw, 38px); margin: 0 0 14px; }
        .lead { color: #bbb; line-height: 1.65; margin: 0 0 28px; }
        label { display: block; font-weight: 700; margin-bottom: 8px; }
        input { width: 100%; background: #000; color: #fff; border: 1px solid #777; padding: 16px; font: inherit; font-size: 24px; letter-spacing: .18em; text-transform: uppercase; outline: none; }
        input:focus { border-color: #fff; box-shadow: 0 0 0 3px rgba(255,255,255,.12); }
        button { width: 100%; padding: 15px 18px; margin-top: 14px; border: 1px solid #fff; font: inherit; font-weight: 800; cursor: pointer; }
        button:disabled { opacity: .55; cursor: wait; }
        .primary { background: #fff; color: #000; }
        .primary:hover:not(:disabled) { background: #d9d9d9; }
        .secondary { background: transparent; color: #ddd; border-color: #555; }
        .account { display: flex; align-items: center; gap: 12px; margin-top: 18px; padding: 12px; border: 1px solid #333; }
        .account img, .account span { width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; background: #fff; color: #000; object-fit: cover; font-weight: 900; }
        .account div { min-width: 0; display: grid; gap: 4px; }
        .account small { color: #aaa; overflow: hidden; text-overflow: ellipsis; }
        .status { border-left: 3px solid #888; padding: 12px; line-height: 1.5; background: #111; }
        .status.success { border-color: #79ff9f; color: #c9ffd8; }
        .status.error { border-color: #ff7777; color: #ffd0d0; }
        .privacy { margin: 24px 0 0; color: #888; font-size: 12px; line-height: 1.6; }
        code { color: #fff; }
      `}</style>
    </>
  );
}
