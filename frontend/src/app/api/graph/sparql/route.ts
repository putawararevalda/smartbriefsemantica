import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const query = body.query || 'SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 25';

    const backendUrl =
      process.env.BACKEND_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      'http://backend:8003';

    const targetEndpoint = `${backendUrl.replace(/\/+$/, '')}/api/graph/sparql`;

    const response = await fetch(targetEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errData.detail || 'SPARQL query execution failed.' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error executing SPARQL query:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error while executing SPARQL query.' },
      { status: 500 }
    );
  }
}
