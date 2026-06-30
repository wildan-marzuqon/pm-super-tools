import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
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
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Access control check for private projects
    if (project.visibility === 'private') {
      const user = await getCurrentUser(request);
      const isPowerUser = user?.roles?.includes('Super Admin') || user?.roles?.includes('PM');
      const isPIC = project.pic && user?.name && project.pic.toLowerCase().trim() === user.name.toLowerCase().trim();

      if (!isPowerUser && !isPIC) {
        return NextResponse.json({ error: 'Akses Ditolak: Proyek ini bersifat privat.' }, { status: 403 });
      }
    }

    // Map Prisma schema model properties to client JSON contract names
    return NextResponse.json({
      id: project.id,
      name: project.name,
      description: project.description,
      deadline: project.deadline,
      pic: project.pic,
      visibility: project.visibility,
      current_stage_index: project.currentStageIndex,
      google_drive_folder_url: project.googleDriveFolderUrl,
      google_api_key: project.googleApiKey,
      jira_project_key: project.jiraProjectKey,
      stages: project.stages.map((s) => ({
        id: s.id,
        projectId: s.projectId,
        name: s.name,
        order: s.order,
        completed_at: s.completedAt ? s.completedAt.toISOString() : null
      })),
      actionItems: project.actions.map((item) => {
        const resolvedStatus = item.completed ? 'done' : (item.status === 'done' ? 'open' : item.status);
        return {
          id: item.id,
          title: item.title,
          description: item.description,
          deadline: item.deadline,
          pic: item.pic,
          completed: item.completed,
          status: resolvedStatus,
          project_id: item.projectId || null,
          source_note_id: item.sourceNoteId || null,
          category_id: item.categoryId || null,
          category_name: item.category?.name || null,
          jiraKey: item.jiraKey || null,
          jiraSyncedAt: item.jiraSyncedAt || null,
          created_at: item.createdAt
        };
      }),
      artifacts: project.artifacts.map((a) => ({
        id: a.id,
        projectId: a.projectId,
        label: a.label,
        url: a.url,
        description: a.description,
        is_synced: a.isSynced,
        type: a.type,
        content: a.content
      })),
      categories: project.categories,
      created_at: project.createdAt
    });
  } catch (error) {
    console.error('Error fetching project detail:', error);
    return NextResponse.json({ error: 'Failed to fetch project detail' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
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
        visibility: body.visibility !== undefined ? body.visibility : undefined,
        currentStageIndex: body.current_stage_index !== undefined ? body.current_stage_index : undefined,
        googleDriveFolderUrl: body.google_drive_folder_url !== undefined ? body.google_drive_folder_url : undefined,
        googleApiKey: body.google_api_key !== undefined ? body.google_api_key : undefined,
        jiraProjectKey: body.jira_project_key !== undefined ? body.jira_project_key : undefined,
      }
    });

    return NextResponse.json(updatedProject);
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
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
