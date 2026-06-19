import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.label || !body.url) {
      return Response.json({ error: 'Label and URL are required' }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id }
    });

    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    const newArtifact = await prisma.artifact.create({
      data: {
        projectId: id,
        label: body.label,
        url: body.url,
        description: body.description || ''
      }
    });

    return Response.json(newArtifact, { status: 201 });
  } catch (error) {
    console.error('Error creating artifact:', error);
    return Response.json({ error: 'Failed to create artifact' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();

    if (!body.id) {
      return Response.json({ error: 'Artifact ID is required for update' }, { status: 400 });
    }

    const updatedArt = await prisma.artifact.update({
      where: {
        id: body.id,
        projectId: projectId
      },
      data: {
        label: body.label !== undefined ? body.label : undefined,
        url: body.url !== undefined ? body.url : undefined,
        description: body.description !== undefined ? body.description : undefined
      }
    });

    return Response.json(updatedArt);
  } catch (error) {
    console.error('Error updating artifact:', error);
    return Response.json({ error: 'Failed to update artifact' }, { status: 500 });
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
      return Response.json({ error: 'Artifact ID is required for delete' }, { status: 400 });
    }

    await prisma.artifact.delete({
      where: {
        id: body.id,
        projectId: projectId
      }
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting artifact:', error);
    return Response.json({ error: 'Failed to delete artifact' }, { status: 500 });
  }
}
