import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getJiraConfig, fetchJiraIssues, createJiraIssue, updateJiraIssue, transitionJiraIssue } from '@/lib/jira-client';

const mapJiraStatusToLocal = (jiraStatus: string, statusesList: string[]) => {
  const normJira = (jiraStatus || '').toLowerCase();

  // 1. If it's a closed/done status
  const isDoneJira = ['done', 'closed', 'resolved', 'complete', 'completed', 'selesai', 'success'].includes(normJira);
  if (isDoneJira) {
    const matchedDone = statusesList.find(s => {
      const norm = s.toLowerCase();
      return norm.includes('done') || norm.includes('selesai') || norm.includes('complete') || norm.includes('success');
    });
    if (matchedDone) return matchedDone;
    return statusesList[statusesList.length - 1] || 'Selesai';
  }

  // 2. If it's an in-progress status
  const isInProgressJira = ['in progress', 'progress', 'sedang dikerjakan', 'working', 'dev'].includes(normJira);
  if (isInProgressJira) {
    const matchedProgress = statusesList.find(s => {
      const norm = s.toLowerCase();
      return norm.includes('progress') || norm.includes('working') || norm.includes('dev') || norm.includes('run');
    });
    if (matchedProgress) return matchedProgress;
  }

  // 3. Try to find an exact case-insensitive match in statusesList
  const exactMatch = statusesList.find(s => s.toLowerCase() === normJira);
  if (exactMatch) return exactMatch;

  // 4. Try to find a match that represents "To Do" or "Open"
  const matchedToDo = statusesList.find(s => {
    const norm = s.toLowerCase();
    return norm.includes('todo') || norm.includes('to do') || norm.includes('open') || norm.includes('pending');
  });
  if (matchedToDo) return matchedToDo;

  // 5. Fallback to the first status in the list
  return statusesList[0] || 'TO DO';
};

const isStatusDone = (status: string) => {
  const norm = (status || '').toLowerCase();
  return norm.includes('done') || norm.includes('selesai') || norm.includes('complete') || norm.includes('success');
};

const isStatusProgress = (status: string) => {
  const norm = (status || '').toLowerCase();
  return norm.includes('progress') || norm.includes('working') || norm.includes('dev') || norm.includes('run');
};

export async function POST(request: NextRequest) {
  try {
    const config = await getJiraConfig();
    if (!config) {
      return NextResponse.json(
        { error: 'Kredensial Jira belum dikonfigurasi di Pengaturan.' },
        { status: 400 }
      );
    }

    const settings = await prisma.systemSetting.findUnique({
      where: { id: 'default' }
    });
    const statusesList = settings?.actionItemStatuses || ["Pending", "Open", "In Progress", "Selesai"];

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const direction = searchParams.get('direction') || 'both'; // 'pull', 'push', or 'both'
    const actionItemIdsParam = searchParams.get('actionItemIds');
    const targetActionItemIds = actionItemIdsParam ? actionItemIdsParam.split(',').map(id => id.trim()).filter(Boolean) : null;

    // 1. Get projects that have a Jira Project Key
    const mappedProjects = await prisma.project.findMany({
      where: {
        AND: [
          { jiraProjectKey: { not: null } },
          { jiraProjectKey: { not: "" } },
          projectId ? { id: projectId } : {}
        ]
      }
    });

    if (mappedProjects.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Tidak ada proyek yang terhubung ke Jira Project Key.',
        pushed: 0,
        pulled: 0,
        cached: 0
      });
    }

    const projectKeys = mappedProjects.map(p => p.jiraProjectKey!).filter(Boolean);
    const projectIds = mappedProjects.map(p => p.id);

    let pushedCount = 0;
    let pulledCount = 0;
    let cachedCount = 0;

    // A. PUSH SIDE: Push local changes/tasks to Jira
    if (direction === 'push' || direction === 'both') {
      // A1. Find unsynced local ActionItems for these projects and send them to Jira
      const unsyncedItems = await prisma.actionItem.findMany({
        where: {
          jiraKey: null,
          projectId: { in: projectIds },
          ...(targetActionItemIds ? { id: { in: targetActionItemIds } } : {})
        },
        include: {
          project: true
        }
      });

      for (const item of unsyncedItems) {
        const projKey = item.project?.jiraProjectKey;
        if (projKey) {
          try {
            const desc = item.description || 'Dibuat dari SuperPM Action Item';
            const deadlineArg = item.deadline || undefined;
            const jiraResult = await createJiraIssue(projKey, item.title, desc, deadlineArg, item.pic || undefined);
            
            // If the task was already completed or in progress locally, transition it in Jira too
            const isDone = item.completed || isStatusDone(item.status);
            const isProgress = isStatusProgress(item.status);
            if (isProgress) {
              try {
                await transitionJiraIssue(jiraResult.key, 'In Progress');
              } catch (transitionErr) {
                console.error(`Failed to transition new Jira issue ${jiraResult.key} to In Progress:`, transitionErr);
              }
            } else if (isDone) {
              try {
                await transitionJiraIssue(jiraResult.key, 'Done');
              } catch (transitionErr) {
                console.error(`Failed to transition new Jira issue ${jiraResult.key} to Done:`, transitionErr);
              }
            }

            // Link local ActionItem to Jira issue
            await prisma.actionItem.update({
              where: { id: item.id },
              data: {
                jiraKey: jiraResult.key,
                jiraSyncedAt: new Date()
              }
            });
            pushedCount++;
          } catch (apiErr) {
            console.error(`Error pushing ActionItem ${item.id} to Jira project ${projKey}:`, apiErr);
          }
        }
      }

      // A2. Push modifications for already synced ActionItems
      const syncedItems = await prisma.actionItem.findMany({
        where: {
          jiraKey: { not: null },
          projectId: { in: projectIds },
          ...(targetActionItemIds ? { id: { in: targetActionItemIds } } : {})
        }
      });

      for (const item of syncedItems) {
        const localUpdated = item.updatedAt;
        const syncedAt = item.jiraSyncedAt || new Date(0);
        const hasChanges = localUpdated.getTime() > syncedAt.getTime() + 1000;

        if (hasChanges || direction === 'push') {
          try {
            const desc = item.description || 'Diperbarui dari SuperPM';
            await updateJiraIssue(item.jiraKey!, item.title, desc, item.deadline || undefined, item.pic || undefined);

            let targetJiraStatus = 'To Do';
            if (isStatusProgress(item.status)) {
              targetJiraStatus = 'In Progress';
            } else if (item.completed || isStatusDone(item.status)) {
              targetJiraStatus = 'Done';
            }
            await transitionJiraIssue(item.jiraKey!, targetJiraStatus);

            await prisma.actionItem.update({
              where: { id: item.id },
              data: {
                jiraSyncedAt: new Date()
              }
            });
            pushedCount++;
          } catch (apiErr) {
            console.error(`Error pushing update for ActionItem ${item.jiraKey} to Jira:`, apiErr);
          }
        }
      }
    }

    // B. PULL SIDE: Fetch issues from Jira, update/create locally
    if (direction === 'pull' || direction === 'both') {
      let fetchedIssues: any[] = [];
      try {
        fetchedIssues = await fetchJiraIssues(projectKeys);
      } catch (fetchErr: any) {
        console.error('Error fetching issues from Jira:', fetchErr);
        return NextResponse.json(
          { error: `Gagal mengambil data dari Jira: ${fetchErr.message || 'Error'}` },
          { status: 500 }
        );
      }

      // B1. Update local cache for Team Load
      try {
        await prisma.$transaction(async (tx) => {
          await tx.jiraIssue.deleteMany({});
          if (fetchedIssues.length > 0) {
            await tx.jiraIssue.createMany({
              data: fetchedIssues.map((issue) => ({
                key: issue.key,
                issueType: issue.issueType,
                summary: issue.summary,
                assignee: issue.assignee,
                priority: issue.priority,
                status: issue.status,
                startDate: issue.startDate,
                dueDate: issue.dueDate,
                originalEstimate: issue.originalEstimate
              }))
            });
            cachedCount = fetchedIssues.length;
          }
        });
      } catch (dbErr) {
        console.error('Error updating JiraIssue cache table:', dbErr);
      }

      // B2. Overwrite local ActionItems or create new ones
      for (const issue of fetchedIssues) {
        const existingItem = await prisma.actionItem.findFirst({
          where: { jiraKey: issue.key }
        });

        let deadlineStr = "";
        if (issue.dueDate) {
          try {
            deadlineStr = new Date(issue.dueDate).toISOString().split('T')[0];
          } catch (e) {
            console.error('Invalid due date format from Jira:', issue.dueDate);
          }
        }

        let startDateStr = "";
        if (issue.startDate) {
          try {
            startDateStr = new Date(issue.startDate).toISOString().split('T')[0];
          } catch (e) {
            console.error('Invalid start date format from Jira:', issue.startDate);
          }
        }

        const localStatus = mapJiraStatusToLocal(issue.status, statusesList);
        const isDone = isStatusDone(localStatus);

        if (existingItem) {
          const localUpdated = existingItem.updatedAt;
          const syncedAt = existingItem.jiraSyncedAt || new Date(0);
          const jiraUpdated = issue.updatedAt || new Date(0);

          const jiraHasChanges = jiraUpdated.getTime() > syncedAt.getTime() + 1000;

          if (jiraHasChanges || direction === 'pull') {
            await prisma.actionItem.update({
              where: { id: existingItem.id },
              data: {
                title: issue.summary,
                description: issue.description || '',
                pic: issue.assignee || 'Unassigned',
                startDate: startDateStr,
                deadline: deadlineStr,
                status: localStatus,
                completed: isDone,
                jiraSyncedAt: new Date(),
                updatedAt: new Date() // Sync local updated timestamp to match sync time
              }
            });
            pulledCount++;
          } else {
            // Keep timestamps updated
            await prisma.actionItem.update({
              where: { id: existingItem.id },
              data: {
                jiraSyncedAt: new Date()
              }
            });
          }
        } else {
          // Create new local task
          const issueProjectKey = issue.key.split('-')[0];
          const matchingProject = mappedProjects.find(
            p => p.jiraProjectKey?.toUpperCase() === issueProjectKey.toUpperCase()
          );

          if (matchingProject) {
            await prisma.actionItem.create({
              data: {
                title: issue.summary,
                description: issue.description || `Ditarik dari Jira (${issue.key})`,
                startDate: startDateStr,
                deadline: deadlineStr,
                pic: issue.assignee || 'Unassigned',
                status: localStatus,
                completed: isDone,
                projectId: matchingProject.id,
                jiraKey: issue.key,
                jiraSyncedAt: new Date(),
                sourceType: "jira"
              }
            });
            pulledCount++;
          }
        }
      }
    }

    let modeMsg = 'Sinkronisasi';
    if (direction === 'pull') modeMsg = 'Pull dari Jira';
    else if (direction === 'push') modeMsg = 'Push ke Jira';

    return NextResponse.json({
      success: true,
      message: `${modeMsg} berhasil diselesaikan!`,
      pushed: pushedCount,
      pulled: pulledCount,
      cached: cachedCount
    });

  } catch (error: any) {
    console.error('Error in Jira sync endpoint:', error);
    return NextResponse.json(
      { error: error.message || 'Terjadi kesalahan internal saat sinkronisasi.' },
      { status: 500 }
    );
  }
}
