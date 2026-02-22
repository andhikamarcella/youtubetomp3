'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type TrendingItem = {
  slug: string;
  title: string;
  artist?: string;
  description?: string;
  imageUrl?: string;
};

export default function TrendingNow() {
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; items: TrendingItem[] }>({
    status: 'idle',
    items: [],
  });

  useEffect(() => {
    const run = async () => {
      setState({ status: 'loading', items: [] });
      try {
        const res = await fetch('/api/trending', { method: 'GET' });
        const data = (await res.json()) as { items?: TrendingItem[] };
        const items = Array.isArray(data?.items) ? data.items : [];
        setState({ status: 'success', items });
      } catch {
        setState({ status: 'error', items: [] });
      }
    };
    run();
  }, []);

  return (
    <div className="card p-4 trending-card">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <h2 className="mb-0" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>
          Trending Now
        </h2>
        <Link className="btn btn-outline-dark btn-sm" href="/discover">
          Discover
        </Link>
      </div>
      {state.status === 'loading' && (
        <div className="mt-3 d-flex align-items-center gap-2 text-secondary">
          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
          Loading trending…
        </div>
      )}
      {state.status === 'error' && <p className="text-danger mt-3 mb-0">Failed to load trending items.</p>}
      {state.status === 'success' && (
        <div className="mt-3">
          {state.items.length === 0 ? (
            <p className="text-secondary mb-0">No trending items yet.</p>
          ) : (
            <div className="trending-list">
              {state.items.map((item) => (
                <Link
                  key={item.slug}
                  href={`/discover/${encodeURIComponent(item.slug)}`}
                  className="trending-row"
                >
                  <Image
                    src={item.imageUrl || '/trending-placeholder.svg'}
                    alt={item.title}
                    width={44}
                    height={44}
                    className="trending-thumb"
                  />
                  <div className="trending-meta">
                    <div className="trending-title">{item.title}</div>
                    <div className="trending-artist">{item.artist || item.description || 'Trending'}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

