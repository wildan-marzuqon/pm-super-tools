import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    
    // Determine filter conditions based on user roles
    const isPowerUser = user?.roles?.includes('Super Admin') || user?.roles?.includes('PM');
    
    const whereCondition = isPowerUser
      ? {} // Power users see everything
      : {
          OR: [
            { visibility: 'public' },
            {
              AND: [
                { visibility: 'private' },
                { pic: { mode: 'insensitive', equals: user?.name || '' } }
              ]
            }
          ]
        };

    const projects = await prisma.project.findMany({
      where: whereCondition as any,
      include: {
        stages: {
          orderBy: { order: 'asc' }
        },
        categories: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Enrich with currentStage and map camelCase to snake_case
    const enrichedProjects = projects.map((proj) => {
      const currentStage = proj.stages[proj.currentStageIndex] || null;
      return {
        ...proj,
        current_stage_index: proj.currentStageIndex,
        currentStage,
        categories: proj.categories
      };
    });

    return NextResponse.json(enrichedProjects, {
      headers: {
        'Cache-Control': 's-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
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
        visibility: body.visibility || 'public',
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

    return NextResponse.json({
      ...newProject,
      current_stage_index: newProject.currentStageIndex,
      currentStage
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
