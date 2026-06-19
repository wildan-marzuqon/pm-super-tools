import { NextRequest } from 'next/server';
import { readDb, writeDb } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = readDb();

    const project = db.projects.find((p) => p.id === id);
    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    const stages = db.project_stages
      .filter((s) => s.project_id === id)
      .sort((a, b) => a.order - b.order);

    const actionItems = db.action_items.filter((item) => item.project_id === id);
    const artifacts = db.artifacts.filter((a) => a.project_id === id);

    return Response.json({
      ...project,
      stages,
      actionItems,
      artifacts,
    });
  } catch (error) {
    console.error('Error fetching project detail:', error);
    return Response.json({ error: 'Failed to fetch project detail' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = readDb();
    const body = await request.json();

    const projectIdx = db.projects.findIndex((p) => p.id === id);
    if (projectIdx === -1) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    const existingProject = db.projects[projectIdx];
    
    const updatedProject = {
      ...existingProject,
      name: body.name !== undefined ? body.name : existingProject.name,
      description: body.description !== undefined ? body.description : existingProject.description,
      deadline: body.deadline !== undefined ? body.deadline : existingProject.deadline,
      pic: body.pic !== undefined ? body.pic : existingProject.pic,
      current_stage_index: body.current_stage_index !== undefined ? body.current_stage_index : existingProject.current_stage_index,
    };

    db.projects[projectIdx] = updatedProject;
    writeDb(db);

    return Response.json(updatedProject);
  } catch (error) {
    console.error('Error updating project:', error);
    return Response.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = readDb();

    const initialLength = db.projects.length;
    db.projects = db.projects.filter((p) => p.id !== id);

    if (db.projects.length === initialLength) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // Clean up related stages, artifacts, and disassociate action items
    db.project_stages = db.project_stages.filter((s) => s.project_id !== id);
    db.artifacts = db.artifacts.filter((art) => art.project_id !== id);
    db.action_items = db.action_items.map((item) => {
      if (item.project_id === id) {
        return { ...item, project_id: undefined };
      }
      return item;
    });

    writeDb(db);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    return Response.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
