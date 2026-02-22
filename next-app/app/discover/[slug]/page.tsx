import { notFound } from 'next/navigation';
import Link from 'next/link';
import { findTrendingBySlug, getTrendingMock } from '../../../lib/trending';
import DiscoverSearchClient from '../search-client';
import { getCachedSearchItems } from '../../../lib/searchServer';

export const revalidate = 21600;

export function generateStaticParams() {
  return getTrendingMock().map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = findTrendingBySlug(slug);
  if (!item) return {};
  const title = `Download ${item.title} MP3 & MP4`;
  const description = item.description || `Convert and download ${item.title} as MP3, M4A, or MP4.`;
  return {
    title,
    description,
    alternates: { canonical: `/discover/${encodeURIComponent(item.slug)}` },
    openGraph: {
      title,
      description,
      url: `/discover/${encodeURIComponent(item.slug)}`,
      type: 'website',
    },
  };
}

export default async function DiscoverSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = findTrendingBySlug(slug);
  if (!item) notFound();
  const cached = await getCachedSearchItems(item.query);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MusicRecording',
    name: item.title,
    url: `/discover/${encodeURIComponent(item.slug)}`,
  };

  return (
    <main className="container pb-5" style={{ position: 'relative', zIndex: 1 }}>
      <nav className="navbar navbar-expand-lg navbar-dark bg-transparent py-3">
        <div className="container px-0">
          <Link className="navbar-brand" href="/">
            <span>ytmp3</span>
            <small className="ms-2 text-secondary">Discover</small>
          </Link>
          <div className="d-flex align-items-center gap-2">
            <Link className="btn btn-outline-light btn-sm" href="/discover">
              Back to Discover
            </Link>
          </div>
        </div>
      </nav>

      <div className="card p-4">
        <h1 className="section-title mb-2">{item.title}</h1>
        <p className="text-secondary mb-4">Download {item.title} MP3 & MP4. Results load instantly when cached.</p>
        <DiscoverSearchClient
          initialQuery={item.query}
          syncToUrl={false}
          initialItems={cached?.items || null}
          initialCached={Boolean(cached)}
        />
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  );
}

