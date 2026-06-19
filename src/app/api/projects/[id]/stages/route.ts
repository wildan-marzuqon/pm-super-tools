import { NextRequest } from 'next/server';
import { readDb, writeDb, ProjectStage } from '@/lib/db';

// POST: Add a new stage to the end of the project stages
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = readDb();
    const body = await request.json();

    if (!body.name) {
      return Response.json({ error: 'Stage name is required' }, { status: 400 });
    }

    const project = db.projects.find((p) => p.id === id);
    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get current stages to determine order
    const currentStages = db.project_stages
      .filter((s) => s.project_id === id)
      .sort((a, b) => a.order - b.order);

    const newStage: ProjectStage = {
      id: `stage-${id}-${Date.now()}`,
      project_id: id,
      name: body.name,
      order: currentStages.length,
      completed_at: undefined
    };

    db.project_stages.push(newStage);
    writeDb(db);

    return Response.json(newStage, { status: 201 });
  } catch (error) {
    console.error('Error adding project stage:', error);
    return Response.json({ error: 'Failed to add stage' }, { status: 500 });
  }
}

// PUT: Bulk update stages for this project (e.g. rename, re-order, delete, add)
// Expects: { stages: Array<{ id?: string, name: string, completed_at?: string }> }
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = readDb();
    const body = await request.json();

    if (!body.stages || !Array.isArray(body.stages)) {
      return Response.json({ error: 'stages array is required' }, { status: 400 });
    }

    const projectIdx = db.projects.findIndex((p) => p.id === id);
    if (projectIdx === -1) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = db.projects[projectIdx];

    // Remove all old stages for this project
    db.project_stages = db.project_stages.filter((s) => s.project_id !== id);

    // Write new stages
    const newStages: ProjectStage[] = body.stages.map((stage: any, idx: number) => ({
      id: stage.id || `stage-${id}-${idx}-${Date.now()}`,
      project_id: id,
      name: stage.name,
      order: idx,
      completed_at: stage.completed_at || undefined,
    }));

    db.project_stages.push(...newStages);

    // Keep current_stage_index within bounds
    if (project.current_stage_index >= newStages.length) {
      project.current_stage_index = Math.max(0, newStages.length - 1);
      db.projects[projectIdx] = project;
    }

    writeDb(db);

    return Response.json(newStages);
  } catch (error) {
    console.error('Error updating project stages:', error);
    return Response.json({ error: 'Failed to update stages' }, { status: 500 });
  }
}
