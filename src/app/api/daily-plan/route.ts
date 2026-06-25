import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

// Helper to convert time "HH:MM" to minutes (handles null)
function timeToMinutes(t: string | null): number {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// Get today's date in UTC+7 (Jakarta) timezone in "YYYY-MM-DD" format
function getJakartaTodayStr(): string {
  const d = new Date();
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(d);
}

// Get current minutes in UTC+7
function getJakartaCurrentMinutes(): number {
  const d = new Date();
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const [h, m] = formatter.format(d).split(':').map(Number);
  return h * 60 + m;
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
        // Skip completed/skipped items or entries without scheduled time
        if (entry.status === 'done' || entry.status === 'skipped' || !entry.startTime || !entry.endTime) {
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

    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (startDate && endDate) {
      const entries = await prisma.dailyPlanEntry.findMany({
        where: {
          date: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          actionItem: {
            include: {
              project: true
            }
          }
        },
        orderBy: [
          { date: 'asc' },
          { startTime: 'asc' }
        ]
      });
      return Response.json(entries, {
        headers: { 'Cache-Control': 'no-store, max-age=0' }
      });
    }

    // Normal list retrieval
    const entries = await prisma.dailyPlanEntry.findMany({
      where: { date: dateStr },
      include: {
        actionItem: {
          include: { project: true }
        }
      },
      orderBy: [{ startTime: 'asc' }]
    });

    return Response.json(entries, {
      headers: { 'Cache-Control': 'no-store, max-age=0' }
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

    // Only date and title are required — startTime/endTime can be null (unscheduled)
    if (!date || !title) {
      return Response.json({ error: 'Date and title are required' }, { status: 400 });
    }

    let linkedActionItemId = actionItemId || null;

    // If type is task and user wanted to create a new action item
    if (type === 'task' && createActionItem && !linkedActionItemId) {
      const newActionItem = await prisma.actionItem.create({
        data: {
          title: title,
          description: notes || '',
          deadline: date,
          pic: 'Wildan',
          status: 'open',
          completed: false
        }
      });
      linkedActionItemId = newActionItem.id;
    }

    const newEntry = await prisma.dailyPlanEntry.create({
      data: {
        date,
        startTime: startTime || null,
        endTime: endTime || null,
        type: type || 'task',
        title,
        notes: notes || null,
        status: status || (type === 'task' ? 'open' : 'pending'),
        actionItemId: linkedActionItemId
      },
      include: {
        actionItem: { include: { project: true } }
      }
    });

    // Sync status if it is a task and already linked to action item
    if ((type === 'task' || !type) && linkedActionItemId && status) {
      const completed = status === 'done';
      await prisma.actionItem.update({
        where: { id: linkedActionItemId },
        data: { status, completed }
      });
    }

    return Response.json(newEntry, { status: 201 });
  } catch (error) {
    console.error('Error creating daily plan entry:', error);
    return Response.json({ error: 'Failed to create daily plan entry' }, { status: 500 });
  }
}
