import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q')?.toLowerCase() || '';
    const folder = searchParams.get('folder') || '';

    // Build the query options
    const whereClause: any = {};

    if (folder) {
      whereClause.folder = folder;
    }

    if (q) {
      whereClause.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
        { tags: { has: q } }
      ];
    }

    const notes = await prisma.note.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        folder: true,
        tags: true,
        updatedAt: true,
        // Only include content snippet for search results, otherwise omit for speed
        content: q ? true : true,
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    return Response.json(notes, {
      headers: {
        'Cache-Control': 's-maxage=10, stale-while-revalidate=30',
      },
    });
  } catch (error) {
    console.error('Error fetching notes:', error);
    return Response.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    if (!body.title) {
      return Response.json({ error: 'Title is required' }, { status: 400 });
    }

    const newNote = await prisma.note.create({
      data: {
        title: body.title,
        content: body.content || '',
        folder: body.folder || 'Uncategorized',
        tags: body.tags || [],
      }
    });

    return Response.json(newNote, { status: 201 });
  } catch (error) {
    console.error('Error creating note:', error);
    return Response.json({ error: 'Failed to create note' }, { status: 500 });
  }
}
