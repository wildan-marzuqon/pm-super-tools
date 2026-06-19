import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
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
        }
      }
    });

    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.stages.length === 0) {
      return Response.json({ error: 'No stages defined for this project' }, { status: 400 });
    }

    const currentStageIdx = project.currentStageIndex;

    // Mark current stage as completed
    if (currentStageIdx < project.stages.length) {
      const currentStage = project.stages[currentStageIdx];
      await prisma.projectStage.update({
        where: { id: currentStage.id },
        data: { completedAt: new Date() }
      });
    }

    // Advance project stage index
    const nextStageIdx = Math.min(currentStageIdx + 1, project.stages.length);
    
    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        currentStageIndex: nextStageIdx
      },
      include: {
        stages: {
          orderBy: { order: 'asc' }
        }
      }
    });

    const currentStage = updatedProject.stages[updatedProject.currentStageIndex] || null;

    return Response.json({
      ...updatedProject,
      currentStage
    });
  } catch (error) {
    console.error('Error advancing project stage:', error);
    return Response.json({ error: 'Failed to advance stage' }, { status: 500 });
  }
}
