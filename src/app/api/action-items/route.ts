import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status');

    const whereClause: any = {};

    if (projectId) {
      whereClause.projectId = projectId;
    }

    if (status) {
      whereClause.status = status;
    }

    const items = await prisma.actionItem.findMany({
      where: whereClause
    });

    // Sort items: empty deadlines last, otherwise nearest deadline first
    items.sort((a, b) => {
      if (a.deadline && b.deadline) {
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return Response.json(items);
  } catch (error) {
    console.error('Error fetching action items:', error);
    return Response.json({ error: 'Failed to fetch action items' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.title) {
      return Response.json({ error: 'Title is required' }, { status: 400 });
    }

    const newItem = await prisma.actionItem.create({
      data: {
        title: body.title,
        description: body.description || '',
        deadline: body.deadline || '',
        pic: body.pic || '',
        status: body.status || 'open',
        sourceNoteId: body.source_note_id || undefined,
        projectId: body.project_id || undefined,
      }
    });

    return Response.json(newItem, { status: 201 });
  } catch (error) {
    console.error('Error creating action item:', error);
    return Response.json({ error: 'Failed to create action item' }, { status: 500 });
  }
}
