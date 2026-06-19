import { NextRequest } from 'next/server';
import { readDb, writeDb, Artifact } from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = readDb();
    const body = await request.json();

    if (!body.label || !body.url) {
      return Response.json({ error: 'Label and URL are required' }, { status: 400 });
    }

    const project = db.projects.find((p) => p.id === id);
    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    const newArtifact: Artifact = {
      id: `art-${Date.now()}`,
      project_id: id,
      label: body.label,
      url: body.url,
      description: body.description || '',
    };

    db.artifacts.push(newArtifact);
    writeDb(db);

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
    const db = readDb();
    const body = await request.json();

    if (!body.id) {
      return Response.json({ error: 'Artifact ID is required for update' }, { status: 400 });
    }

    const artIdx = db.artifacts.findIndex((art) => art.id === body.id && art.project_id === projectId);
    if (artIdx === -1) {
      return Response.json({ error: 'Artifact not found' }, { status: 404 });
    }

    const existingArt = db.artifacts[artIdx];
    const updatedArt = {
      ...existingArt,
      label: body.label !== undefined ? body.label : existingArt.label,
      url: body.url !== undefined ? body.url : existingArt.url,
      description: body.description !== undefined ? body.description : existingArt.description,
    };

    db.artifacts[artIdx] = updatedArt;
    writeDb(db);

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
    const db = readDb();
    const body = await request.json();

    if (!body.id) {
      return Response.json({ error: 'Artifact ID is required for delete' }, { status: 400 });
    }

    const initialLength = db.artifacts.length;
    db.artifacts = db.artifacts.filter((art) => !(art.id === body.id && art.project_id === projectId));

    if (db.artifacts.length === initialLength) {
      return Response.json({ error: 'Artifact not found' }, { status: 404 });
    }

    writeDb(db);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting artifact:', error);
    return Response.json({ error: 'Failed to delete artifact' }, { status: 500 });
  }
}
