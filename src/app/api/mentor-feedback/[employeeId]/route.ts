import { NextRequest, NextResponse } from 'next/server';
import { getMentorFeedback, saveMentorFeedback, getMemberFeedbackProfile } from '@/lib/mentor-feedback-service';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  const { employeeId } = await params;
  const isSSE = req.headers.get('accept')?.includes('text/event-stream');

  if (!isSSE) {
    const feedback = await getMentorFeedback(employeeId);
    return NextResponse.json({ feedback });
  }

  // Server-Sent Events (SSE) Stream for real-time live synchronization
  const encoder = new TextEncoder();
  let intervalId: NodeJS.Timeout | null = null;
  let lastKnownTimestamp = '';

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial data immediately
      try {
        const initial = await getMentorFeedback(employeeId);
        if (initial) {
          lastKnownTimestamp = initial.lastUpdated;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(initial)}\n\n`));
        }
      } catch (err) {
        console.error('Error sending initial SSE data:', err);
      }

      // Check for updates every 1.5 seconds and push to client if changed
      intervalId = setInterval(async () => {
        try {
          const current = await getMentorFeedback(employeeId);
          if (current && current.lastUpdated !== lastKnownTimestamp) {
            lastKnownTimestamp = current.lastUpdated;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(current)}\n\n`));
          }
        } catch (err) {
          console.error('Error during SSE poll check:', err);
        }
      }, 1500);
    },
    cancel() {
      if (intervalId) {
        clearInterval(intervalId);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const { employeeId } = await params;
    const body = await req.json();

    const saved = await saveMentorFeedback({
      ...body,
      employeeId,
    });

    return NextResponse.json({ feedback: saved, success: true });
  } catch (error: any) {
    console.error('Error saving mentor feedback:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save mentor feedback' },
      { status: 500 }
    );
  }
}
