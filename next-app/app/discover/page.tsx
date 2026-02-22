import DiscoverSearchClient from './search-client';
import Link from 'next/link';
import { getCachedSearchItems } from '../../lib/searchServer';

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qRaw = params?.q;
  const q = Array.isArray(qRaw) ? qRaw[0] : qRaw;
  const cached = q ? await getCachedSearchItems(String(q)) : null;
  return (
    <main className="container pb-5" style={{ position: 'relative', zIndex: 1 }}>
      <nav className="navbar navbar-expand-lg navbar-dark bg-transparent py-3">
        <div className="container px-0">
          <Link className="navbar-brand" href="/">
            <span>ytmp3</span>
            <small className="ms-2 text-secondary">Discover</small>
          </Link>
          <div className="d-flex align-items-center gap-2">
            <Link className="btn btn-outline-light btn-sm" href="/">
              Converter
            </Link>
          </div>
        </div>
      </nav>

      <div className="card p-4">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
          <h1 className="section-title mb-0">Discover</h1>
        </div>
        <div className="mt-3">
          <DiscoverSearchClient
            initialQuery={q ? String(q) : ''}
            syncToUrl
            initialItems={cached?.items || null}
            initialCached={Boolean(cached)}
          />
        </div>
      </div>
    </main>
  );
}

