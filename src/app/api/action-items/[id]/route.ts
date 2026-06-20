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
        completed: body.completed !== undefined ? body.completed : undefined,
        projectId: body.project_id !== undefined ? body.project_id : undefined,
        categoryId: body.category_id !== undefined ? body.category_id : undefined,
        sourceNoteId: body.source_note_id !== undefined ? body.source_note_id : undefined,
      },
      include: {
        category: true
      }
    });

    return Response.json({
      id: updatedItem.id,
      title: updatedItem.title,
      description: updatedItem.description,
      deadline: updatedItem.deadline,
      pic: updatedItem.pic,
      completed: updatedItem.completed,
      project_id: updatedItem.projectId || null,
      source_note_id: updatedItem.sourceNoteId || null,
      category_id: updatedItem.categoryId || null,
      category_name: updatedItem.category?.name || null,
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
