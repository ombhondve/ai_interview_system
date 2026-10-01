import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

export async function POST(
  request: NextRequest,
  { params }: { params: { interviewId: string; action: string } }
) {
  try {
    const { interviewId, action } = params;
    const searchParams = request.nextUrl.searchParams;
    const candidateId = searchParams.get('candidateId');

    if (!candidateId) {
      return NextResponse.json(
        { error: 'Missing candidateId' },
        { status: 400 }
      );
    }

    // Map frontend actions to backend endpoints
    const actionMap: Record<string, string> = {
      'start-preparation': 'preparation/start',
      'update-preparation': 'preparation',
      'confirm-readiness': 'preparation/confirm',
      'reschedule': 'reschedule',
      'cancel': 'cancel',
      'status': 'status',
    };

    const backendAction = actionMap[action];
    if (!backendAction) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    const url = `${BACKEND_URL}/api/interviews/${interviewId}/candidate/${candidateId}/${backendAction}`;
    
    const body = action === 'status' ? undefined : await request.json();

    const response = await fetch(url, {
      method: action === 'status' ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(request.headers.get('authorization') && {
          'Authorization': request.headers.get('authorization')!
        }),
      },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error(`Error in interview ${params.action}:`, error);
    return NextResponse.json(
      { error: `Failed to ${params.action} interview` },
      { status: 500 }
    );
  }
}
