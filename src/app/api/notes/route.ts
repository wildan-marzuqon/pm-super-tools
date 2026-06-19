import { NextRequest } from 'next/server';
import { readDb, writeDb, Note } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const db = readDb();
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q')?.toLowerCase() || '';
    const folder = searchParams.get('folder') || '';

    let notes = [...db.notes];

    if (q) {
      notes = notes.filter(
        (note) =>
          note.title.toLowerCase().includes(q) ||
          note.content.toLowerCase().includes(q) ||
          note.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }

    if (folder) {
      notes = notes.filter((note) => note.folder === folder);
    }

    // Sort by updated_at descending
    notes.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    return Response.json(notes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    return Response.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = readDb();
    const body = await request.json();
    
    if (!body.title) {
      return Response.json({ error: 'Title is required' }, { status: 400 });
    }

    const newNote: Note = {
      id: `note-${Date.now()}`,
      title: body.title,
      content: body.content || '',
      folder: body.folder || 'Uncategorized',
      tags: body.tags || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.notes.push(newNote);
    writeDb(db);

    return Response.json(newNote, { status: 201 });
  } catch (error) {
    console.error('Error creating note:', error);
    return Response.json({ error: 'Failed to create note' }, { status: 500 });
  }
}
