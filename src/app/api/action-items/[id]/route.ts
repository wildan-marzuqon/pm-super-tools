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

    const itemIndex = db.action_items.findIndex((item) => item.id === id);
    if (itemIndex === -1) {
      return Response.json({ error: 'Action item not found' }, { status: 404 });
    }

    const existingItem = db.action_items[itemIndex];
    const updatedItem = {
      ...existingItem,
      title: body.title !== undefined ? body.title : existingItem.title,
      description: body.description !== undefined ? body.description : existingItem.description,
      deadline: body.deadline !== undefined ? body.deadline : existingItem.deadline,
      pic: body.pic !== undefined ? body.pic : existingItem.pic,
      status: body.status !== undefined ? body.status : existingItem.status,
      project_id: body.project_id !== undefined ? body.project_id : existingItem.project_id,
      source_note_id: body.source_note_id !== undefined ? body.source_note_id : existingItem.source_note_id,
    };

    db.action_items[itemIndex] = updatedItem;
    writeDb(db);

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
    const db = readDb();

    const initialLength = db.action_items.length;
    db.action_items = db.action_items.filter((item) => item.id !== id);

    if (db.action_items.length === initialLength) {
      return Response.json({ error: 'Action item not found' }, { status: 404 });
    }

    writeDb(db);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting action item:', error);
    return Response.json({ error: 'Failed to delete action item' }, { status: 500 });
  }
}
