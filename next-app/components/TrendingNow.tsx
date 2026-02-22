import Link from 'next/link';
import { useEffect, useState } from 'react';

type TrendingItem = {
  slug: string;
  title: string;
  description?: string;
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
    <div className="card p-4">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <h2 className="section-title mb-0">Trending Now</h2>
        <Link className="btn btn-outline-light btn-sm" href="/discover">
          Discover
        </Link>
      </div>
      {state.status === 'loading' && (
        <div className="mt-3 d-flex align-items-center gap-2 text-secondary">
          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
          Loading trending…
        </div>
      )}
      {state.status === 'error' && <p className="text-warning mt-3 mb-0">Failed to load trending items.</p>}
      {state.status === 'success' && (
        <div className="mt-3">
          {state.items.length === 0 ? (
            <p className="text-secondary mb-0">No trending items yet.</p>
          ) : (
            <div className="list-group">
              {state.items.map((item) => (
                <Link
                  key={item.slug}
                  href={`/discover/${encodeURIComponent(item.slug)}`}
                  className="list-group-item list-group-item-action bg-transparent text-light border-secondary"
                >
                  <div className="d-flex flex-column gap-1">
                    <div className="fw-semibold">{item.title}</div>
                    {item.description ? <div className="text-secondary small">{item.description}</div> : null}
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

