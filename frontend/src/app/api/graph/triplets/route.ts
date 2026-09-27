import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const backendUrl =
      process.env.BACKEND_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      'http://backend:8003';

    const targetEndpoint = `${backendUrl.replace(/\/+$/, '')}/api/graph/triplets`;

    const response = await fetch(targetEndpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errData.detail || 'Failed to fetch Oxigraph triplets from backend.' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching triplets:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error while retrieving Oxigraph triplets.' },
      { status: 500 }
    );
  }
}
