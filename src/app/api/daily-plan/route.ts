import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

// Helper to convert time "HH:MM" to minutes
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// Get today's date in UTC+7 (Jakarta) timezone
function getJakartaTodayStr(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const wibTime = new Date(utc + (3600000 * 7));
  return wibTime.toISOString().split('T')[0];
}

// Get current minutes in UTC+7
function getJakartaCurrentMinutes(): number {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const wibTime = new Date(utc + (3600000 * 7));
  return wibTime.getHours() * 60 + wibTime.getMinutes();
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    let dateStr = searchParams.get('date');
    const badge = searchParams.get('badge') === 'true';

    if (!dateStr || dateStr === 'today') {
      dateStr = getJakartaTodayStr();
    }

    if (badge) {
      // Find entries for today to check if badge should be active
      const entries = await prisma.dailyPlanEntry.findMany({
        where: { date: dateStr }
      });

      const currentMinutes = getJakartaCurrentMinutes();
      let hasBadge = false;
      let type: 'ongoing' | 'upcoming' | null = null;

      for (const entry of entries) {
        // Skip completed/skipped items
        if (entry.status === 'done' || entry.status === 'skipped') {
          continue;
        }

        const startMin = timeToMinutes(entry.startTime);
        const endMin = timeToMinutes(entry.endTime);

        // Ongoing check: started and not finished yet
        if (currentMinutes >= startMin && currentMinutes < endMin) {
          hasBadge = true;
          type = 'ongoing';
          break; // Ongoing takes precedence
        }

        // Upcoming check: starts in <= 15 minutes
        if (startMin > currentMinutes && (startMin - currentMinutes) <= 15) {
          hasBadge = true;
          type = 'upcoming';
        }
      }

      return Response.json({ badge: hasBadge, type });
    }

    // Normal list retrieval
    const entries = await prisma.dailyPlanEntry.findMany({
      where: { date: dateStr },
      include: {
        actionItem: {
          include: {
            project: true
          }
        }
      },
      orderBy: [
        { startTime: 'asc' }
      ]
    });

    return Response.json(entries, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (error) {
    console.error('Error fetching daily plan entries:', error);
    return Response.json({ error: 'Failed to fetch daily plan entries' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, startTime, endTime, type, title, notes, status, actionItemId, createActionItem } = body;

    if (!date || !startTime || !endTime || !title) {
      return Response.json({ error: 'Date, startTime, endTime, and title are required' }, { status: 400 });
    }

    let linkedActionItemId = actionItemId || null;

    // If type is task and user wanted to create a new action item
    if (type === 'task' && createActionItem && !linkedActionItemId) {
      const newActionItem = await prisma.actionItem.create({
        data: {
          title: title,
          description: notes || '',
          deadline: date,
          pic: 'Wildan', // Default PIC per commitments
          status: 'open',
          completed: false
        }
      });
      linkedActionItemId = newActionItem.id;
    }

    const newEntry = await prisma.dailyPlanEntry.create({
      data: {
        date,
        startTime,
        endTime,
        type,
        title,
        notes: notes || null,
        status: status || (type === 'task' ? 'open' : 'pending'),
        actionItemId: linkedActionItemId
      },
      include: {
        actionItem: true
      }
    });

    // Sync status if it is a task and already linked to action item
    if (type === 'task' && linkedActionItemId && status) {
      const completed = status === 'done';
      await prisma.actionItem.update({
        where: { id: linkedActionItemId },
        data: {
          status,
          completed
        }
      });
    }

    return Response.json(newEntry, { status: 201 });
  } catch (error) {
    console.error('Error creating daily plan entry:', error);
    return Response.json({ error: 'Failed to create daily plan entry' }, { status: 500 });
  }
}
