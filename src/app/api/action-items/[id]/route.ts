import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updatedItem = await prisma.actionItem.update({
      where: { id },
      data: {
        title: body.title !== undefined ? body.title : undefined,
        description: body.description !== undefined ? body.description : undefined,
        deadline: body.deadline !== undefined ? body.deadline : undefined,
        pic: body.pic !== undefined ? body.pic : undefined,
        status: body.status !== undefined ? body.status : undefined,
        projectId: body.project_id !== undefined ? body.project_id : undefined,
        sourceNoteId: body.source_note_id !== undefined ? body.source_note_id : undefined,
      }
    });

    return Response.json(updatedItem);
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
