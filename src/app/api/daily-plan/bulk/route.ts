import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyCapability } from '@/lib/auth';

// POST /api/daily-plan/bulk
// Body: { actionItemIds: string[], date: string }
// Creates one DailyPlanEntry per action item with no scheduled time (unscheduled)
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyCapability(request, 'manage_daily_plan');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { actionItemIds, date } = body;

    if (!date || !Array.isArray(actionItemIds) || actionItemIds.length === 0) {
      return NextResponse.json(
        { error: 'date and actionItemIds[] are required' },
        { status: 400 }
      );
    }

    // Fetch the action items to get their titles
    const actionItems = await prisma.actionItem.findMany({
      where: { id: { in: actionItemIds } }
    });

    if (actionItems.length === 0) {
      return NextResponse.json({ error: 'No valid action items found' }, { status: 404 });
    }

    // Create a daily plan entry for each action item
    const created = await Promise.all(
      actionItems.map((item) =>
        prisma.dailyPlanEntry.create({
          data: {
            date,
            startTime: null,   // unscheduled — user fills in later
            endTime: null,
            type: 'task',
            title: item.title,
            notes: null,
            status: 'open',
            actionItemId: item.id
          },
          include: {
            actionItem: { include: { project: true } }
          }
        })
      )
    );

    return NextResponse.json({ created: created.length, entries: created }, { status: 201 });
  } catch (error) {
    console.error('Error bulk-creating daily plan entries:', error);
    return NextResponse.json({ error: 'Failed to bulk create daily plan entries' }, { status: 500 });
  }
}
