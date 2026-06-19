import { NextRequest } from 'next/server';
import { readDb, writeDb } from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = readDb();

    const projectIndex = db.projects.findIndex((p) => p.id === id);
    if (projectIndex === -1) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = db.projects[projectIndex];
    const stages = db.project_stages
      .filter((s) => s.project_id === id)
      .sort((a, b) => a.order - b.order);

    if (stages.length === 0) {
      return Response.json({ error: 'No stages defined for this project' }, { status: 400 });
    }

    const currentStageIdx = project.current_stage_index;

    // Mark current stage as completed
    if (currentStageIdx < stages.length) {
      const currentStage = stages[currentStageIdx];
      const stageIdxInDb = db.project_stages.findIndex((s) => s.id === currentStage.id);
      if (stageIdxInDb !== -1) {
        db.project_stages[stageIdxInDb].completed_at = new Date().toISOString();
      }
    }

    // Advance project stage index (but don't exceed the last stage)
    const nextStageIdx = Math.min(currentStageIdx + 1, stages.length);
    project.current_stage_index = nextStageIdx;
    
    db.projects[projectIndex] = project;
    writeDb(db);

    // Re-fetch updated stages
    const updatedStages = db.project_stages
      .filter((s) => s.project_id === id)
      .sort((a, b) => a.order - b.order);

    return Response.json({
      ...project,
      stages: updatedStages,
      currentStage: updatedStages[project.current_stage_index] || null
    });
  } catch (error) {
    console.error('Error advancing project stage:', error);
    return Response.json({ error: 'Failed to advance stage' }, { status: 500 });
  }
}
