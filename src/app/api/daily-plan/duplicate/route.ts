import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceDate, targetDate } = body;

    if (!sourceDate || !targetDate) {
      return NextResponse.json(
        { error: 'sourceDate and targetDate are required' },
        { status: 400 }
      );
    }

    // 1. Fetch entries from sourceDate
    const sourceEntries = await prisma.dailyPlanEntry.findMany({
      where: { date: sourceDate }
    });

    if (sourceEntries.length === 0) {
      return NextResponse.json(
        { error: 'No daily plan entries found on the source date' },
        { status: 404 }
      );
    }

    // 2. Delete all existing entries on targetDate (to overwrite)
    await prisma.dailyPlanEntry.deleteMany({
      where: { date: targetDate }
    });

    // 3. Create duplicates for targetDate
    const createdEntries = await Promise.all(
      sourceEntries.map((entry) => {
        // Reset status for the next day
        const defaultStatus = entry.type === 'task' ? 'open' : 'pending';
        
        return prisma.dailyPlanEntry.create({
          data: {
            date: targetDate,
            startTime: entry.startTime,
            endTime: entry.endTime,
            type: entry.type,
            title: entry.title,
            notes: entry.notes,
            status: defaultStatus,
            actionItemId: entry.actionItemId
          }
        });
      })
    );

    return NextResponse.json({
      success: true,
      message: `Duplicated ${createdEntries.length} entries to ${targetDate}`,
      count: createdEntries.length
    });
  } catch (error: any) {
    console.error('Error duplicating daily plan:', error);
    return NextResponse.json(
      { error: 'Failed to duplicate daily plan: ' + error.message },
      { status: 500 }
    );
  }
}
