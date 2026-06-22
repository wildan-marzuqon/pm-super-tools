import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const issues = await prisma.jiraIssue.findMany({
      orderBy: { key: 'asc' }
    });
    return NextResponse.json(issues);
  } catch (error) {
    console.error('Error fetching Jira issues:', error);
    return NextResponse.json({ error: 'Failed to fetch Jira issues' }, { status: 500 });
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
