import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = new URL(`${BACKEND_URL}/api/interviews/slots`);
    
    // Forward query parameters
    searchParams.forEach((value, key) => {
      url.searchParams.append(key, value);
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Forward authorization header if present
        ...(request.headers.get('authorization') && {
          'Authorization': request.headers.get('authorization')!
        }),
      },
      credentials: 'include',
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error('Error fetching interview slots:', error);
    return NextResponse.json(
      { error: 'Failed to fetch interview slots' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { candidateId, slotId, ...bookingData } = body;

    if (!candidateId || !slotId) {
      return NextResponse.json(
        { error: 'Missing candidateId or slotId' },
        { status: 400 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/api/interviews/${candidateId}/book/${slotId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(request.headers.get('authorization') && {
          'Authorization': request.headers.get('authorization')!
        }),
      },
      credentials: 'include',
      body: JSON.stringify(bookingData),
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error('Error booking interview:', error);
    return NextResponse.json(
      { error: 'Failed to book interview' },
      { status: 500 }
    );
  }
}
