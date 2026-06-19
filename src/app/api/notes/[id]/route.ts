import { NextRequest } from 'next/server';
import { readDb, writeDb } from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = readDb();
    const body = await request.json();

    const noteIndex = db.notes.findIndex((n) => n.id === id);
    if (noteIndex === -1) {
      return Response.json({ error: 'Note not found' }, { status: 404 });
    }

    const existingNote = db.notes[noteIndex];
    const updatedNote = {
      ...existingNote,
      title: body.title !== undefined ? body.title : existingNote.title,
      content: body.content !== undefined ? body.content : existingNote.content,
      folder: body.folder !== undefined ? body.folder : existingNote.folder,
      tags: body.tags !== undefined ? body.tags : existingNote.tags,
      updated_at: new Date().toISOString(),
    };

    db.notes[noteIndex] = updatedNote;
    writeDb(db);

    return Response.json(updatedNote);
  } catch (error) {
    console.error('Error updating note:', error);
    return Response.json({ error: 'Failed to update note' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = readDb();

    const initialLength = db.notes.length;
    db.notes = db.notes.filter((n) => n.id !== id);

    if (db.notes.length === initialLength) {
      return Response.json({ error: 'Note not found' }, { status: 404 });
    }

    // Optionally disassociate action items or delete them
    // Let's keep them but remove their note source link
    db.action_items = db.action_items.map(item => {
      if (item.source_note_id === id) {
        return { ...item, source_note_id: undefined };
      }
      return item;
    });

    writeDb(db);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting note:', error);
    return Response.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}
