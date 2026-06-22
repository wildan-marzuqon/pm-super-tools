import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        stages: {
          orderBy: { order: 'asc' }
        },
        actions: {
          include: {
            category: true
          }
        },
        artifacts: true,
        categories: true
      }
    });

    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // Map Prisma schema model properties to client JSON contract names
    return Response.json({
      id: project.id,
      name: project.name,
      description: project.description,
      deadline: project.deadline,
      pic: project.pic,
      current_stage_index: project.currentStageIndex,
      stages: project.stages.map((s) => ({
        id: s.id,
        projectId: s.projectId,
        name: s.name,
        order: s.order,
        completed_at: s.completedAt ? s.completedAt.toISOString() : null
      })),
      actionItems: project.actions.map((item) => ({
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
        created_at: item.createdAt
      })),
      artifacts: project.artifacts,
      categories: project.categories,
      created_at: project.createdAt
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
    const body = await request.json();

    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        name: body.name !== undefined ? body.name : undefined,
        description: body.description !== undefined ? body.description : undefined,
        deadline: body.deadline !== undefined ? body.deadline : undefined,
        pic: body.pic !== undefined ? body.pic : undefined,
        currentStageIndex: body.current_stage_index !== undefined ? body.current_stage_index : undefined,
      }
    });

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

    // Delete project
    // Cascade deletes are configured on the DB level via Prisma schema (onDelete: Cascade)
    // So stages, artifacts, and action items will automatically be deleted by PostgreSQL!
    await prisma.project.delete({
      where: { id }
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    return Response.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
