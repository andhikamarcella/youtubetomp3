'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type SearchItem = {
  id: string;
  title: string;
  author?: string;
  thumbnail?: string;
  webpageUrl?: string;
};

type ApiPayload = {
  q?: string;
  cached?: boolean;
  items?: SearchItem[];
};

export default function DiscoverSearchClient({
  initialQuery,
  syncToUrl = true,
  initialItems = null,
  initialCached = false,
}: {
  initialQuery: string;
  syncToUrl?: boolean;
  initialItems?: SearchItem[] | null;
  initialCached?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery || '');
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; cached: boolean; items: SearchItem[] }>({
    status: initialItems && initialItems.length > 0 ? 'success' : initialQuery ? 'loading' : 'idle',
    cached: Boolean(initialItems && initialItems.length > 0 ? true : initialCached),
    items: Array.isArray(initialItems) ? initialItems : [],
  });
  const inflight = useRef<AbortController | null>(null);

  useEffect(() => {
    setQ(initialQuery || '');
  }, [initialQuery]);

  const runSearch = async (query: string) => {
    const normalized = String(query || '').trim();
    if (!normalized) {
      setState({ status: 'idle', cached: false, items: [] });
      return;
    }
    setState((s) => ({ ...s, status: 'loading', items: [] }));
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    try {
      const url = new URL('/api/search', window.location.origin);
      url.searchParams.set('q', normalized);
      const res = await fetch(url.toString(), { method: 'GET', signal: controller.signal });
      const payload = (await res.json()) as ApiPayload;
      const items = Array.isArray(payload?.items) ? payload.items : [];
      if (!res.ok) throw new Error('search_failed');
      setState({ status: 'success', cached: Boolean(payload?.cached), items });
    } catch (e) {
      if ((e as any)?.name === 'AbortError') return;
      setState({ status: 'error', cached: false, items: [] });
    }
  };

  useEffect(() => {
    if (!initialQuery) return;
    if (Array.isArray(initialItems) && initialItems.length > 0) return;
    runSearch(initialQuery);
  }, [initialQuery]);

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div className="d-flex flex-column">
          <div className="fw-semibold" style={{ fontSize: '1.1rem' }}>
            Search
          </div>
          <div className="text-secondary">Paste a keyword and search cached results.</div>
        </div>
        {state.status === 'success' && (
          <span className="badge-chip" style={{ opacity: 0.9 }}>
            {state.cached ? 'Cached' : 'Live'}
          </span>
        )}
      </div>

      <form
        className="row g-3 mt-2"
        onSubmit={(e) => {
          e.preventDefault();
          const next = String(q || '').trim();
          if (syncToUrl) {
            router.replace(next ? `/discover?q=${encodeURIComponent(next)}` : '/discover');
          }
          runSearch(next);
        }}
      >
        <div className="col-12 col-md-9">
          <label htmlFor="discover-q" className="form-label">
            Keyword
          </label>
          <input
            id="discover-q"
            className="form-control form-control-lg"
            placeholder="e.g. Bad Bunny DTMF"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="col-12 col-md-3 d-flex align-items-end">
          <button className="btn btn-primary btn-lg w-100" type="submit" disabled={state.status === 'loading'}>
            {state.status === 'loading' ? (
              <span className="d-flex align-items-center justify-content-center gap-2">
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                Searching…
              </span>
            ) : (
              'Search'
            )}
          </button>
        </div>
      </form>

      {state.status === 'error' && <p className="text-warning mt-3 mb-0">Search failed. Try again.</p>}
      {state.status === 'success' && (
        <div className="mt-3">
          {state.items.length === 0 ? (
            <p className="text-secondary mb-0">No results.</p>
          ) : (
            <div className="list-group">
              {state.items.map((item) => (
                <a
                  key={item.id}
                  href={item.webpageUrl || '#'}
                  className="list-group-item bg-transparent text-light border-secondary"
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className="d-flex gap-3 align-items-start">
                    {item.thumbnail ? (
                      <img
                        src={item.thumbnail}
                        alt=""
                        width={56}
                        height={56}
                        style={{ borderRadius: 10, objectFit: 'cover', flex: '0 0 auto' }}
                      />
                    ) : null}
                    <div className="d-flex flex-column">
                      <div className="fw-semibold">{item.title}</div>
                      {item.author ? <div className="text-secondary small">{item.author}</div> : null}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

