import { prisma } from './prisma';

export interface JiraConfig {
  jiraUrl: string;
  jiraEmail: string;
  jiraToken: string;
}

/**
 * Fetch Jira configurations from the database.
 */
export async function getJiraConfig(): Promise<JiraConfig | null> {
  const setting = await prisma.systemSetting.findUnique({
    where: { id: 'default' }
  });

  if (!setting?.jiraUrl || !setting?.jiraEmail || !setting?.jiraToken) {
    return null;
  }

  return {
    jiraUrl: setting.jiraUrl.replace(/\/+$/, ''), // remove trailing slash
    jiraEmail: setting.jiraEmail,
    jiraToken: setting.jiraToken
  };
}

/**
 * Helper to construct the Basic Auth headers.
 */
function getAuthHeaders(config: JiraConfig) {
  const credentials = `${config.jiraEmail}:${config.jiraToken}`;
  const base64Credentials = Buffer.from(credentials).toString('base64');
  return {
    'Authorization': `Basic ${base64Credentials}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
}

/**
 * Construct standard Atlassian Document Format (ADF) description.
 */
function buildADFDescription(text: string) {
  return {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: text || 'No description provided.'
          }
        ]
      }
    ]
  };
}

function parseADFDescription(adf: any): string {
  if (!adf) return '';
  if (typeof adf === 'string') return adf;
  if (adf.type === 'doc' && Array.isArray(adf.content)) {
    let text = '';
    for (const block of adf.content) {
      if (block.type === 'paragraph' && Array.isArray(block.content)) {
        for (const inline of block.content) {
          if (inline.type === 'text' && inline.text) {
            text += inline.text;
          }
        }
        text += '\n';
      } else if (block.type === 'bulletList' || block.type === 'orderedList') {
        if (Array.isArray(block.content)) {
          for (const item of block.content) {
            if (item.type === 'listItem' && Array.isArray(item.content)) {
              for (const p of item.content) {
                if (p.type === 'paragraph' && Array.isArray(p.content)) {
                  for (const inline of p.content) {
                    if (inline.type === 'text' && inline.text) {
                      text += `- ${inline.text}`;
                    }
                  }
                  text += '\n';
                }
              }
            }
          }
        }
      }
    }
    return text.trim();
  }
  return '';
}

/**
 * Fetch issues from Jira for a list of project keys.
 */
export async function fetchJiraIssues(projectKeys: string[]): Promise<any[]> {
  const config = await getJiraConfig();
  if (!config) {
    throw new Error('Jira is not configured. Please set credentials in Settings.');
  }

  if (projectKeys.length === 0) {
    return [];
  }

  const jql = `project in (${projectKeys.map(k => `"${k}"`).join(',')})`;
  const url = `${config.jiraUrl}/rest/api/3/search/jql`;

  const response = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(config),
    body: JSON.stringify({
      jql,
      maxResults: 100,
      fields: [
        'key',
        'issuetype',
        'summary',
        'description',
        'assignee',
        'priority',
        'status',
        'duedate',
        'created',
        'updated',
        'timetracking',
        'timeoriginalestimate'
      ]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Jira API Search Error:', errText);
    throw new Error(`Failed to fetch issues from Jira: ${response.statusText} (${response.status})`);
  }

  const data = await response.json();
  const issues = data.issues || [];

  return issues.map((issue: any) => {
    const fields = issue.fields || {};
    return {
      key: issue.key,
      issueType: fields.issuetype?.name || 'Task',
      summary: fields.summary || '',
      description: parseADFDescription(fields.description),
      assignee: fields.assignee?.displayName || 'Unassigned',
      priority: fields.priority?.name || 'Medium',
      status: fields.status?.name || 'To Do',
      startDate: fields.created ? new Date(fields.created) : null,
      dueDate: fields.duedate ? new Date(fields.duedate) : null,
      originalEstimate: fields.timetracking?.originalEstimateSeconds || fields.timeoriginalestimate || 0,
      updatedAt: fields.updated ? new Date(fields.updated) : null
    };
  });
}

/**
 * Find a Jira user's accountId by their display name.
 */
export async function findJiraUser(displayName: string): Promise<string | null> {
  if (!displayName || displayName.toLowerCase() === 'unassigned') {
    return null;
  }
  const config = await getJiraConfig();
  if (!config) return null;

  try {
    const url = `${config.jiraUrl}/rest/api/3/user/search?query=${encodeURIComponent(displayName)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(config)
    });
    if (response.ok) {
      const users = await response.json();
      if (Array.isArray(users) && users.length > 0) {
        return users[0].accountId || null;
      }
    }
  } catch (err) {
    console.error(`Error searching Jira user by display name "${displayName}":`, err);
  }
  return null;
}

/**
 * Create a new task/issue in Jira.
 */
export async function createJiraIssue(
  projectKey: string,
  summary: string,
  description: string,
  deadline?: string,
  assigneeName?: string
): Promise<{ key: string; self: string }> {
  const config = await getJiraConfig();
  if (!config) {
    throw new Error('Jira is not configured. Please set credentials in Settings.');
  }

  let accountId: string | null = null;
  if (assigneeName) {
    accountId = await findJiraUser(assigneeName);
  }

  const url = `${config.jiraUrl}/rest/api/3/issue`;
  const body: any = {
    fields: {
      project: {
        key: projectKey
      },
      summary,
      description: buildADFDescription(description),
      issuetype: {
        name: 'Task' // Default to Task
      }
    }
  };

  if (deadline) {
    body.fields.duedate = deadline;
  }
  if (accountId) {
    body.fields.assignee = { accountId };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(config),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Jira API Create Issue Error:', errText);
    throw new Error(`Failed to create issue in Jira: ${response.statusText} (${response.status})`);
  }

  const data = await response.json();
  return {
    key: data.key,
    self: data.self
  };
}

/**
 * Update an issue's summary and description in Jira.
 */
export async function updateJiraIssue(
  jiraKey: string,
  summary: string,
  description: string,
  deadline?: string,
  assigneeName?: string
): Promise<void> {
  const config = await getJiraConfig();
  if (!config) {
    throw new Error('Jira is not configured. Please set credentials in Settings.');
  }

  let accountId: string | null = null;
  if (assigneeName) {
    accountId = await findJiraUser(assigneeName);
  }

  const url = `${config.jiraUrl}/rest/api/3/issue/${jiraKey}`;
  const body: any = {
    fields: {
      summary,
      description: buildADFDescription(description)
    }
  };

  if (deadline) {
    body.fields.duedate = deadline;
  } else {
    body.fields.duedate = null;
  }

  if (accountId) {
    body.fields.assignee = { accountId };
  } else if (assigneeName && (assigneeName.toLowerCase() === 'unassigned' || assigneeName.toLowerCase() === '')) {
    body.fields.assignee = { accountId: null };
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: getAuthHeaders(config),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Jira API Update Issue Error:', errText);
    throw new Error(`Failed to update issue ${jiraKey} in Jira: ${response.statusText} (${response.status})`);
  }
}

/**
 * Transition an issue to a new status (e.g. Done or In Progress).
 */
export async function transitionJiraIssue(jiraKey: string, targetStatusName: string): Promise<void> {
  const config = await getJiraConfig();
  if (!config) {
    throw new Error('Jira is not configured. Please set credentials in Settings.');
  }

  // 1. Get available transitions
  const transitionsUrl = `${config.jiraUrl}/rest/api/3/issue/${jiraKey}/transitions`;
  const transitionsRes = await fetch(transitionsUrl, {
    method: 'GET',
    headers: getAuthHeaders(config)
  });

  if (!transitionsRes.ok) {
    throw new Error(`Failed to fetch transitions for ${jiraKey}`);
  }

  const transitionsData = await transitionsRes.json();
  const transitions = transitionsData.transitions || [];

  // 2. Find transition matching the target status name
  // Match case-insensitive
  const matchedTransition = transitions.find((t: any) =>
    t.name.toLowerCase() === targetStatusName.toLowerCase() ||
    t.to?.name.toLowerCase() === targetStatusName.toLowerCase()
  );

  if (!matchedTransition) {
    console.warn(`No transition found matching status "${targetStatusName}" for issue ${jiraKey}. Available:`, transitions.map((t: any) => t.name).join(', '));
    return; // Ignore if transition is not available
  }

  // 3. Post transition
  const response = await fetch(transitionsUrl, {
    method: 'POST',
    headers: getAuthHeaders(config),
    body: JSON.stringify({
      transition: {
        id: matchedTransition.id
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`Jira API Transition Error for ${jiraKey}:`, errText);
    throw new Error(`Failed to transition issue ${jiraKey} to ${targetStatusName}`);
  }
}
