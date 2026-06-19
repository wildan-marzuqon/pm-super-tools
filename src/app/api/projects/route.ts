import { NextRequest } from 'next/server';
import { readDb, writeDb, Project, ProjectStage } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const db = readDb();
    
    // Enrich projects with their stages
    const enrichedProjects = db.projects.map((proj) => {
      const stages = db.project_stages
        .filter((s) => s.project_id === proj.id)
        .sort((a, b) => a.order - b.order);
      
      const currentStage = stages[proj.current_stage_index] || null;

      return {
        ...proj,
        stages,
        currentStage,
      };
    });

    // Sort by created_at descending
    enrichedProjects.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return Response.json(enrichedProjects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return Response.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = readDb();
    const body = await request.json();

    if (!body.name) {
      return Response.json({ error: 'Project name is required' }, { status: 400 });
    }

    const projectId = `proj-${Date.now()}`;
    const newProject: Project = {
      id: projectId,
      name: body.name,
      description: body.description || '',
      deadline: body.deadline || '',
      pic: body.pic || '',
      current_stage_index: 0,
      created_at: new Date().toISOString(),
    };

    // Initialize custom or default stages
    const inputStages: string[] = body.stages && body.stages.length > 0 
      ? body.stages 
      : ['Ideation', 'POC', 'Kick Off', 'Implementation', 'Live'];

    const newStages: ProjectStage[] = inputStages.map((stageName, idx) => ({
      id: `stage-${projectId}-${idx}-${Date.now()}`,
      project_id: projectId,
      name: stageName,
      order: idx,
      completed_at: idx === 0 ? new Date().toISOString() : undefined // First stage is completed by default or is the active one?
      // Wait, in PRD: "tahap yang selesai berubah jd centang, tahap aktif di-highlight, tahap berikutnya abu-abu"
      // If we are at index 0, is it active or completed?
      // If index is 0, stages before 0 are completed (none). Stage index 0 is active.
      // So if index is current_stage_index, then stages with order < current_stage_index are marked completed.
      // Let's implement that! Completed is based on whether it is less than current_stage_index, or completed_at is set.
      // Better: we can manage completed_at dynamically.
      // When we advance a stage:
      // stage[current_stage_index].completed_at = now
      // current_stage_index += 1
      // That is extremely logical!
    }));

    db.projects.push(newProject);
    db.project_stages.push(...newStages);
    
    writeDb(db);

    return Response.json({
      ...newProject,
      stages: newStages,
      currentStage: newStages[0] || null
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    return Response.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
