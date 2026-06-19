import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updatedNote = await prisma.note.update({
      where: { id },
      data: {
        title: body.title !== undefined ? body.title : undefined,
        content: body.content !== undefined ? body.content : undefined,
        folder: body.folder !== undefined ? body.folder : undefined,
        tags: body.tags !== undefined ? body.tags : undefined,
      }
    });

    return Response.json(updatedNote);
  } catch (error) {
    console.error('Error updating note:', error);
    // If note not found, Prisma throws error
    return Response.json({ error: 'Failed to update note' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Delete note
    // Note that we set sourceNoteId to null on associated action items in database level onDelete SetNull
    await prisma.note.delete({
      where: { id }
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting note:', error);
    return Response.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}
