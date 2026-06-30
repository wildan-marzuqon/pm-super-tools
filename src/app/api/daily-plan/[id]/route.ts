import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyCapability } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyCapability(request, 'manage_daily_plan');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await params;
    const body = await request.json();
    const { date, startTime, endTime, type, title, notes, status, actionItemId } = body;

    const existingEntry = await prisma.dailyPlanEntry.findUnique({
      where: { id }
    });

    if (!existingEntry) {
      return Response.json({ error: 'Daily plan entry not found' }, { status: 404 });
    }

    const updatedEntry = await prisma.dailyPlanEntry.update({
      where: { id },
      data: {
        date: date !== undefined ? date : undefined,
        // Allow explicit null to clear a scheduled time
        startTime: startTime !== undefined ? (startTime || null) : undefined,
        endTime: endTime !== undefined ? (endTime || null) : undefined,
        type: type !== undefined ? type : undefined,
        title: title !== undefined ? title : undefined,
        notes: notes !== undefined ? notes : undefined,
        status: status !== undefined ? status : undefined,
        actionItemId: actionItemId !== undefined ? actionItemId : undefined
      },
      include: {
        actionItem: true
      }
    });

    // Sync to ActionItem if type is task and actionItem is linked
    const targetActionItemId = actionItemId !== undefined ? actionItemId : updatedEntry.actionItemId;
    const currentStatus = status !== undefined ? status : updatedEntry.status;
    const currentType = type !== undefined ? type : updatedEntry.type;

    if (currentType === 'task' && targetActionItemId && status !== undefined) {
      const completed = currentStatus === 'done';
      await prisma.actionItem.update({
        where: { id: targetActionItemId },
        data: {
          status: currentStatus,
          completed
        }
      });
    }

    return Response.json(updatedEntry);
  } catch (error) {
    console.error('Error updating daily plan entry:', error);
    return Response.json({ error: 'Failed to update daily plan entry' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyCapability(request, 'manage_daily_plan');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await params;

    await prisma.dailyPlanEntry.delete({
      where: { id }
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting daily plan entry:', error);
    return Response.json({ error: 'Failed to delete daily plan entry' }, { status: 500 });
  }
}
