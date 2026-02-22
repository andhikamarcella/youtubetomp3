import trending from '../data/trending.json';

export type TrendingItem = {
  slug: string;
  title: string;
  query: string;
  description?: string;
};

export function getTrendingMock(): TrendingItem[] {
  return (trending as TrendingItem[]).filter((item) => item?.slug && item?.title && item?.query);
}

export function findTrendingBySlug(slug: string) {
  const items = getTrendingMock();
  return items.find((item) => item.slug === slug) || null;
}

