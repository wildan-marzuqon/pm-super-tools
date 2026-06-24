import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');
    const completedParam = searchParams.get('completed');

    const whereClause: any = {};

    if (projectId) {
      whereClause.projectId = projectId;
    }

    if (completedParam === 'true') {
      whereClause.completed = true;
    } else if (completedParam === 'false') {
      whereClause.completed = false;
    }

    const items = await prisma.actionItem.findMany({
      where: whereClause,
      include: {
        category: true
      },
      orderBy: [
        { deadline: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    const mappedItems = items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      deadline: item.deadline,
      pic: item.pic,
      completed: item.completed,
      project_id: item.projectId || null,
      source_note_id: item.sourceNoteId || null,
      category_id: item.categoryId || null,
      category_name: item.category?.name || null,
      jiraKey: item.jiraKey || null,
      jiraSyncedAt: item.jiraSyncedAt || null,
      created_at: item.createdAt
    }));

    return Response.json(mappedItems, {
      headers: {
        'Cache-Control': 's-maxage=10, stale-while-revalidate=30',
      },
    });
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
        completed: body.completed || false,
        sourceNoteId: body.source_note_id || null,
        projectId: body.project_id || null,
        categoryId: body.category_id || null,
      }
    });

    const createdItem = await prisma.actionItem.findUnique({
      where: { id: newItem.id },
      include: {
        category: true
      }
    });

    if (!createdItem) {
      throw new Error('Created item not found');
    }

    return Response.json({
      id: createdItem.id,
      title: createdItem.title,
      description: createdItem.description,
      deadline: createdItem.deadline,
      pic: createdItem.pic,
      completed: createdItem.completed,
      project_id: createdItem.projectId || null,
      source_note_id: createdItem.sourceNoteId || null,
      category_id: createdItem.categoryId || null,
      category_name: createdItem.category?.name || null,
      jiraKey: createdItem.jiraKey || null,
      jiraSyncedAt: createdItem.jiraSyncedAt || null,
      created_at: createdItem.createdAt
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating action item:', error);
    return Response.json({ error: 'Failed to create action item' }, { status: 500 });
  }
}
