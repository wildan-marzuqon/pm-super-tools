import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const projects = await prisma.project.findMany({
      include: {
        stages: {
          orderBy: { order: 'asc' }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Enrich with currentStage
    const enrichedProjects = projects.map((proj) => {
      const currentStage = proj.stages[proj.currentStageIndex] || null;
      return {
        ...proj,
        currentStage
      };
    });

    return Response.json(enrichedProjects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return Response.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.name) {
      return Response.json({ error: 'Project name is required' }, { status: 400 });
    }

    const inputStages: string[] = body.stages && body.stages.length > 0 
      ? body.stages 
      : ['Ideation', 'POC', 'Kick Off', 'Implementation', 'Live'];

    const newProject = await prisma.project.create({
      data: {
        name: body.name,
        description: body.description || '',
        deadline: body.deadline || '',
        pic: body.pic || '',
        currentStageIndex: 0,
        stages: {
          create: inputStages.map((stageName, idx) => ({
            name: stageName,
            order: idx,
            completedAt: idx === 0 ? new Date() : null
          }))
        }
      },
      include: {
        stages: {
          orderBy: { order: 'asc' }
        }
      }
    });

    const currentStage = newProject.stages[0] || null;

    return Response.json({
      ...newProject,
      currentStage
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    return Response.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
