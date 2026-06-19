import { NextRequest } from 'next/server';
import { readDb, writeDb, ActionItem } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const db = readDb();
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status');

    let items = [...db.action_items];

    if (projectId) {
      items = items.filter((item) => item.project_id === projectId);
    }

    if (status) {
      items = items.filter((item) => item.status === status);
    }

    // Sort by deadline ascending (nearest first) then created_at descending
    items.sort((a, b) => {
      if (a.deadline && b.deadline) {
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return Response.json(items);
  } catch (error) {
    console.error('Error fetching action items:', error);
    return Response.json({ error: 'Failed to fetch action items' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = readDb();
    const body = await request.json();

    if (!body.title) {
      return Response.json({ error: 'Title is required' }, { status: 400 });
    }

    const newItem: ActionItem = {
      id: `action-${Date.now()}`,
      title: body.title,
      description: body.description || '',
      deadline: body.deadline || '',
      pic: body.pic || '',
      status: body.status || 'open',
      source_note_id: body.source_note_id || undefined,
      project_id: body.project_id || undefined,
      created_at: new Date().toISOString(),
    };

    db.action_items.push(newItem);
    writeDb(db);

    return Response.json(newItem, { status: 201 });
  } catch (error) {
    console.error('Error creating action item:', error);
    return Response.json({ error: 'Failed to create action item' }, { status: 500 });
  }
}
