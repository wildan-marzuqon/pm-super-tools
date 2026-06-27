import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // 1. Get cached Jira issues assignees to build the valid name list
    const jiraIssues = await prisma.jiraIssue.findMany({});
    const jiraAssignees = new Set<string>();
    jiraIssues.forEach(issue => {
      const name = (issue.assignee || '').trim().toLowerCase();
      if (name && name !== 'unassigned') {
        jiraAssignees.add(name);
      }
    });

    // 2. Fetch all ActionItems (our single source of truth)
    const actionItems = await prisma.actionItem.findMany({
      orderBy: { createdAt: 'desc' }
    });

    // 3. Filter ActionItems:
    // - If it is a Jira issue (has jiraKey), keep it.
    // - If it is manual (no jiraKey), only keep it if PIC matches one of the Jira assignees.
    const filteredIssues = actionItems
      .filter(item => {
        const isJira = !!item.jiraKey;
        if (isJira) return true;

        const picName = (item.pic || '').trim().toLowerCase();
        return picName && picName !== 'unassigned' && jiraAssignees.has(picName);
      })
      .map(item => {
        const key = item.jiraKey || `AI-${item.id.slice(0, 4).toUpperCase()}`;
        return {
          id: item.id,
          key,
          issueType: 'Task',
          summary: item.title,
          assignee: item.pic || 'Unassigned',
          priority: 'Medium',
          status: item.status,
          startDate: item.startDate ? new Date(item.startDate) : null,
          dueDate: item.deadline ? new Date(item.deadline) : null,
          originalEstimate: Number(item.originalEstimate) || 0,
          createdAt: item.createdAt
        };
      });

    return NextResponse.json(filteredIssues);
  } catch (error) {
    console.error('Error fetching combined action items for team load:', error);
    return NextResponse.json({ error: 'Failed to fetch issues' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { issues } = body;

    if (!issues || !Array.isArray(issues)) {
      return NextResponse.json({ error: 'issues array is required' }, { status: 400 });
    }

    // Replace all existing issues in a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Delete all old issues
      await tx.jiraIssue.deleteMany({});

      // 2. Insert new issues
      if (issues.length > 0) {
        await tx.jiraIssue.createMany({
          data: issues.map((issue: any) => ({
            key: issue.key,
            issueType: issue.issueType || 'Task',
            summary: issue.summary || '',
            assignee: issue.assignee || 'Unassigned',
            priority: issue.priority || 'Medium',
            status: issue.status || 'To Do',
            startDate: issue.startDate ? new Date(issue.startDate) : null,
            dueDate: issue.dueDate ? new Date(issue.dueDate) : null,
            originalEstimate: Number(issue.originalEstimate) || 0
          }))
        });
      }
    });

    const updatedIssues = await prisma.jiraIssue.findMany({
      orderBy: { key: 'asc' }
    });

    return NextResponse.json(updatedIssues);
  } catch (error) {
    console.error('Error saving Jira issues:', error);
    return NextResponse.json({ error: 'Failed to save Jira issues' }, { status: 500 });
  }
}
