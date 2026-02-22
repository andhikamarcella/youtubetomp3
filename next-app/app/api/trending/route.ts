import { NextResponse } from 'next/server';
import { getTrendingMock } from '../../../lib/trending';

export async function GET() {
  const items = getTrendingMock();
  return NextResponse.json({ items });
}

