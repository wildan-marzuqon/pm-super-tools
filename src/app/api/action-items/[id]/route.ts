import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    let status = body.status;
    let completed = body.completed;

    if (status !== undefined && completed !== undefined) {
      if (status === 'done') {
        completed = true;
      } else if (completed) {
        status = 'done';
      }
    } else if (status !== undefined) {
      completed = status === 'done';
    } else if (completed !== undefined) {
      status = completed ? 'done' : 'open';
    }

    const updatedItem = await prisma.actionItem.update({
      where: { id },
      data: {
        title: body.title !== undefined ? body.title : undefined,
        description: body.description !== undefined ? body.description : undefined,
        deadline: body.deadline !== undefined ? body.deadline : undefined,
        pic: body.pic !== undefined ? body.pic : undefined,
        completed: completed !== undefined ? completed : undefined,
        status: status !== undefined ? status : undefined,
        projectId: body.project_id !== undefined ? body.project_id : undefined,
        categoryId: body.category_id !== undefined ? body.category_id : undefined,
        sourceNoteId: body.source_note_id !== undefined ? body.source_note_id : undefined,
      },
      include: {
        category: true
      }
    });

    // Sync status change to DailyPlanEntry
    if (status !== undefined) {
      await prisma.dailyPlanEntry.updateMany({
        where: {
          actionItemId: id,
          type: 'task'
        },
        data: {
          status: status
        }
      });
    }

    return Response.json({
      id: updatedItem.id,
      title: updatedItem.title,
      description: updatedItem.description,
      deadline: updatedItem.deadline,
      pic: updatedItem.pic,
      completed: updatedItem.completed,
      status: updatedItem.status,
      project_id: updatedItem.projectId || null,
      source_note_id: updatedItem.sourceNoteId || null,
      category_id: updatedItem.categoryId || null,
      category_name: updatedItem.category?.name || null,
      jiraKey: updatedItem.jiraKey || null,
      jiraSyncedAt: updatedItem.jiraSyncedAt || null,
      created_at: updatedItem.createdAt
    });
  } catch (error) {
    console.error('Error updating action item:', error);
    return Response.json({ error: 'Failed to update action item' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.actionItem.delete({
      where: { id }
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting action item:', error);
    return Response.json({ error: 'Failed to delete action item' }, { status: 500 });
  }
}
