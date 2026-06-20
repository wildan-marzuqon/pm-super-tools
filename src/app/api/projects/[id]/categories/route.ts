import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const categories = await prisma.projectCategory.findMany({
      where: { projectId: id },
      orderBy: { name: 'asc' }
    });
    return Response.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return Response.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.name) {
      return Response.json({ error: 'Name is required' }, { status: 400 });
    }

    const newCategory = await prisma.projectCategory.create({
      data: {
        projectId: id,
        name: body.name
      }
    });

    return Response.json(newCategory, { status: 201 });
  } catch (error) {
    console.error('Error creating category:', error);
    return Response.json({ error: 'Failed to create category' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();

    if (!body.id) {
      return Response.json({ error: 'Category ID is required' }, { status: 400 });
    }

    await prisma.projectCategory.delete({
      where: { 
        id: body.id,
        projectId: projectId 
      }
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    return Response.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
