import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getJiraConfig, fetchJiraIssues, createJiraIssue, transitionJiraIssue } from '@/lib/jira-client';

export async function POST(request: NextRequest) {
  try {
    const config = await getJiraConfig();
    if (!config) {
      return NextResponse.json(
        { error: 'Kredensial Jira belum dikonfigurasi di Pengaturan.' },
        { status: 400 }
      );
    }

    // 1. Get all projects that have a Jira Project Key
    const mappedProjects = await prisma.project.findMany({
      where: {
        AND: [
          { jiraProjectKey: { not: null } },
          { jiraProjectKey: { not: "" } }
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

    // 2. Push Sync: Find unsynced local ActionItems for these projects and send them to Jira
    const unsyncedItems = await prisma.actionItem.findMany({
      where: {
        jiraKey: null,
        projectId: { in: projectIds }
      },
      include: {
        project: true
      }
    });

    let pushedCount = 0;
    for (const item of unsyncedItems) {
      const projKey = item.project?.jiraProjectKey;
      if (projKey) {
        try {
          const desc = item.description || 'Dibuat dari SuperPM Action Item';
          const jiraResult = await createJiraIssue(projKey, item.title, desc);
          
          // If the task was already completed locally, transition it in Jira too
          if (item.completed) {
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

    // 3. Pull Sync: Fetch all issues from Jira for the mapped projects
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

    // 4. Update the local cache (JiraIssue table) for Team Load
    let cachedCount = 0;
    try {
      await prisma.$transaction(async (tx) => {
        // Delete all old cache entries
        await tx.jiraIssue.deleteMany({});

        // Re-populate with fetched issues
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

    // 5. Update local ActionItems based on pulled Jira issue statuses
    let pulledCount = 0;
    const closedStatusNames = ['done', 'closed', 'resolved', 'complete', 'completed', 'selesai'];
    
    for (const issue of fetchedIssues) {
      const isDone = closedStatusNames.includes(issue.status.toLowerCase());
      
      // Update local action items linked to this Jira issue
      const updated = await prisma.actionItem.updateMany({
        where: { jiraKey: issue.key },
        data: {
          completed: isDone,
          jiraSyncedAt: new Date()
        }
      });
      
      if (updated.count > 0) {
        pulledCount += updated.count;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Sinkronisasi Jira berhasil diselesaikan!',
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
