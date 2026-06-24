import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const idsParam = searchParams.get('ids');

    let whereClause: any = { status: 'pending' };

    if (idsParam) {
      const ids = idsParam.split(',');
      whereClause.id = { in: ids };
    }

    const drafts = await prisma.wACopilotDraft.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });

    return Response.json(drafts);
  } catch (error) {
    console.error('Error fetching drafts:', error);
    return Response.json({ error: 'Failed to fetch drafts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, draftId, updatedData } = body;

    if (!draftId) {
      return Response.json({ error: 'Draft ID is required' }, { status: 400 });
    }

    // Handle ignore action
    if (action === 'ignore') {
      await prisma.wACopilotDraft.update({
        where: { id: draftId },
        data: { status: 'ignored' }
      });
      return Response.json({ success: true, message: 'Draft ignored successfully' });
    }

    // Handle approve action
    if (action === 'approve') {
      const draft = await prisma.wACopilotDraft.findUnique({
        where: { id: draftId }
      });

      if (!draft) {
        return Response.json({ error: 'Draft not found' }, { status: 404 });
      }

      // Merge data from updated client fields
      const dataToSave = {
        title: updatedData?.title || draft.title,
        description: updatedData?.description || draft.description,
        pic: updatedData?.pic || draft.pic,
        deadline: updatedData?.deadline || draft.deadline,
        projectId: updatedData?.projectId || draft.projectId || null,
        severity: updatedData?.severity || 'medium' // For blockers
      };

      if (draft.type === 'action_item') {
        await prisma.actionItem.create({
          data: {
            title: dataToSave.title,
            description: dataToSave.description,
            deadline: dataToSave.deadline,
            pic: dataToSave.pic,
            completed: false,
            projectId: dataToSave.projectId,
            sourceType: 'whatsapp',
            waChatName: 'Telegram Bot'
          }
        });
      } else if (draft.type === 'decision') {
        await prisma.decision.create({
          data: {
            summary: dataToSave.title, // Maps title to summary
            decidedBy: dataToSave.pic || null, // Maps assignee (PIC) to decidedBy
            projectId: dataToSave.projectId,
            waChatName: 'Telegram Bot'
          }
        });
      } else if (draft.type === 'blocker') {
        await prisma.projectRisk.create({
          data: {
            issue: dataToSave.title, // Maps title to issue
            impact: dataToSave.description || null, // Maps description to impact
            severity: dataToSave.severity,
            status: 'active',
            projectId: dataToSave.projectId,
            waChatName: 'Telegram Bot'
          }
        });
      } else {
        return Response.json({ error: `Invalid draft type: ${draft.type}` }, { status: 400 });
      }

      // Delete draft once approved/promoted
      await prisma.wACopilotDraft.delete({
        where: { id: draftId }
      });

      // Clear Next.js cache so the newly created item shows up immediately on Vercel
      try {
        revalidatePath('/action-items');
        revalidatePath('/projects');
        if (dataToSave.projectId) {
          revalidatePath(`/projects/${dataToSave.projectId}`);
        }
        revalidatePath('/');
        revalidatePath('/wa-copilot');
      } catch (cacheErr) {
        console.error('Failed to revalidate paths:', cacheErr);
      }

      return Response.json({ success: true, message: 'Draft approved and promoted successfully' });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error processing draft:', error);
    return Response.json({ error: 'Failed to process draft' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (id) {
      await prisma.wACopilotDraft.delete({
        where: { id }
      });
      return Response.json({ success: true, message: 'Draft deleted' });
    }

    // Delete all ignored drafts as clean up
    await prisma.wACopilotDraft.deleteMany({
      where: { status: 'ignored' }
    });
    return Response.json({ success: true, message: 'Ignored drafts cleared' });
  } catch (error) {
    console.error('Error deleting draft(s):', error);
    return Response.json({ error: 'Failed to delete draft(s)' }, { status: 500 });
  }
}
