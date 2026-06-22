import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST: Add a new stage to the end of the project stages list
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.name) {
      return Response.json({ error: 'Stage name is required' }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: { stages: true }
    });

    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    const orderIdx = project.stages.length;

    const newStage = await prisma.projectStage.create({
      data: {
        projectId: id,
        name: body.name,
        order: orderIdx
      }
    });

    return Response.json({
      id: newStage.id,
      projectId: newStage.projectId,
      name: newStage.name,
      order: newStage.order,
      completed_at: newStage.completedAt ? newStage.completedAt.toISOString() : null
    }, { status: 201 });
  } catch (error) {
    console.error('Error adding project stage:', error);
    return Response.json({ error: 'Failed to add stage' }, { status: 500 });
  }
}

// PUT: Bulk update stages for this project
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.stages || !Array.isArray(body.stages)) {
      return Response.json({ error: 'stages array is required' }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id }
    });

    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // Run delete and inserts inside a Prisma transaction
    await prisma.$transaction(async (tx) => {
      // 1. Delete all old stages
      await tx.projectStage.deleteMany({
        where: { projectId: id }
      });

      // 2. Insert new stages
      // Note: mapping completed_at/completedAt from client
      await tx.projectStage.createMany({
        data: body.stages.map((stage: any, idx: number) => ({
          projectId: id,
          name: stage.name,
          order: idx,
          completedAt: stage.completed_at || stage.completedAt 
            ? new Date(stage.completed_at || stage.completedAt) 
            : null
        }))
      });

      // 3. Cap currentStageIndex if it exceeds new count
      const newStagesCount = body.stages.length;
      if (project.currentStageIndex >= newStagesCount) {
        await tx.project.update({
          where: { id },
          data: {
            currentStageIndex: Math.max(0, newStagesCount - 1)
          }
        });
      }
    });

    // Fetch updated stages list
    const updatedStages = await prisma.projectStage.findMany({
      where: { projectId: id },
      orderBy: { order: 'asc' }
    });

    return Response.json(updatedStages.map(s => ({
      id: s.id,
      projectId: s.projectId,
      name: s.name,
      order: s.order,
      completed_at: s.completedAt ? s.completedAt.toISOString() : null
    })));
  } catch (error) {
    console.error('Error updating project stages:', error);
    return Response.json({ error: 'Failed to update stages' }, { status: 500 });
  }
}
