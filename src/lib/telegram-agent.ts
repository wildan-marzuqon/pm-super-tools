import { prisma } from './prisma';
import { getGeminiApiKey } from './gemini';

// Database Executor Functions
async function executeListProjects() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'desc' }
  });
  return { success: true, count: projects.length, projects };
}

async function executeListActionItems(
  status?: string,
  pic?: string,
  projectId?: string,
  excludeCompleted?: boolean,
  deadlineStart?: string,
  deadlineEnd?: string
) {
  const where: any = {};
  
  if (status) {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus === 'open') {
      where.OR = [
        { status: { equals: 'open', mode: 'insensitive' } },
        { status: { equals: 'to do', mode: 'insensitive' } },
        { status: { equals: 'testing', mode: 'insensitive' } },
        { status: { equals: 'in progress', mode: 'insensitive' } },
        { status: { equals: 'pending', mode: 'insensitive' } },
      ];
    } else if (lowerStatus === 'completed' || lowerStatus === 'selesai' || lowerStatus === 'done') {
      where.OR = [
        { status: { equals: 'selesai', mode: 'insensitive' } },
        { status: { equals: 'done', mode: 'insensitive' } },
        { completed: true }
      ];
    } else {
      where.status = { equals: status, mode: 'insensitive' };
    }
  }

  if (excludeCompleted) {
    where.completed = false;
    if (!status) {
      if (where.OR) {
        // keep existing OR filter
      } else {
        where.NOT = [
          { status: { equals: 'selesai', mode: 'insensitive' } },
          { status: { equals: 'done', mode: 'insensitive' } }
        ];
      }
    }
  }

  if (pic) {
    where.pic = { contains: pic, mode: 'insensitive' };
  }
  if (projectId) {
    where.projectId = projectId;
  }

  if (deadlineStart || deadlineEnd) {
    where.deadline = {};
    if (deadlineStart) {
      where.deadline.gte = deadlineStart;
    }
    if (deadlineEnd) {
      where.deadline.lte = deadlineEnd;
      where.deadline.not = "";
    }
  }

  const actionItems = await prisma.actionItem.findMany({
    where,
    orderBy: [
      { deadline: 'asc' },
      { createdAt: 'desc' }
    ],
    take: 50
  });

  return { success: true, count: actionItems.length, actionItems };
}

async function executeCreateActionItem(
  title: string,
  description?: string,
  deadline?: string,
  pic?: string,
  projectId?: string
) {
  const actionItem = await prisma.actionItem.create({
    data: {
      title,
      description: description || "",
      deadline: deadline || "",
      pic: pic || "",
      projectId: projectId || null,
      status: "open"
    }
  });
  return { success: true, actionItem };
}

async function executeUpdateActionItem(
  id?: string,
  title?: string,
  status?: string,
  completed?: boolean,
  deadline?: string,
  pic?: string,
  description?: string
) {
  let targetId = id;
  if (!targetId && title) {
    const found = await prisma.actionItem.findFirst({
      where: { title: { contains: title, mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' }
    });
    if (found) {
      targetId = found.id;
    }
  }
  if (!targetId) {
    return { success: false, error: "Action item not found by ID or title" };
  }

  const data: any = {};
  if (status !== undefined) data.status = status;
  if (completed !== undefined) data.completed = completed;
  if (deadline !== undefined) data.deadline = deadline;
  if (pic !== undefined) data.pic = pic;
  if (description !== undefined) data.description = description;

  const updated = await prisma.actionItem.update({
    where: { id: targetId },
    data
  });
  return { success: true, actionItem: updated };
}

async function executeDeleteActionItem(id?: string, title?: string) {
  let targetId = id;
  if (!targetId && title) {
    const found = await prisma.actionItem.findFirst({
      where: { title: { contains: title, mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' }
    });
    if (found) {
      targetId = found.id;
    }
  }
  if (!targetId) {
    return { success: false, error: "Action item not found" };
  }
  const deleted = await prisma.actionItem.delete({
    where: { id: targetId }
  });
  return { success: true, deletedId: deleted.id, title: deleted.title };
}

async function executeListDailyPlans(date?: string, startDate?: string, endDate?: string) {
  let targetDate = date;
  if (!targetDate && !startDate) {
    targetDate = new Date().toISOString().split('T')[0];
  }
  const where: any = {};
  if (targetDate) {
    where.date = targetDate;
  } else if (startDate) {
    where.date = {
      gte: startDate,
      lte: endDate || startDate
    };
  }
  const entries = await prisma.dailyPlanEntry.findMany({
    where,
    orderBy: [
      { startTime: 'asc' },
      { createdAt: 'asc' }
    ]
  });
  return { success: true, count: entries.length, entries };
}

async function executeCreateDailyPlanEntry(
  date: string,
  title: string,
  startTime?: string,
  endTime?: string,
  type?: string,
  notes?: string,
  actionItemId?: string
) {
  const entry = await prisma.dailyPlanEntry.create({
    data: {
      date,
      title,
      startTime: startTime || null,
      endTime: endTime || null,
      type: type || "task",
      notes: notes || "",
      actionItemId: actionItemId || null,
      status: "open"
    }
  });
  return { success: true, entry };
}

async function executeUpdateDailyPlanEntry(
  id?: string,
  title?: string,
  date?: string,
  status?: string,
  startTime?: string,
  endTime?: string,
  notes?: string
) {
  let targetId = id;
  if (!targetId && title) {
    const whereClause: any = { title: { contains: title, mode: 'insensitive' } };
    if (date) whereClause.date = date;
    const found = await prisma.dailyPlanEntry.findFirst({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });
    if (found) {
      targetId = found.id;
    }
  }
  if (!targetId) {
    return { success: false, error: "Daily plan entry not found" };
  }

  const data: any = {};
  if (status !== undefined) data.status = status;
  if (startTime !== undefined) data.startTime = startTime;
  if (endTime !== undefined) data.endTime = endTime;
  if (notes !== undefined) data.notes = notes;

  const updated = await prisma.dailyPlanEntry.update({
    where: { id: targetId },
    data
  });
  return { success: true, entry: updated };
}

async function executeDeleteDailyPlanEntry(id?: string, title?: string, date?: string) {
  let targetId = id;
  if (!targetId && title) {
    const whereClause: any = { title: { contains: title, mode: 'insensitive' } };
    if (date) whereClause.date = date;
    const found = await prisma.dailyPlanEntry.findFirst({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });
    if (found) {
      targetId = found.id;
    }
  }
  if (!targetId) {
    return { success: false, error: "Daily plan entry not found" };
  }
  const deleted = await prisma.dailyPlanEntry.delete({
    where: { id: targetId }
  });
  return { success: true, deletedId: deleted.id, title: deleted.title };
}

async function executeGetDailyRecap(date?: string) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  const projectsCount = await prisma.project.count();
  
  // get action items due today or overdue
  const actionItems = await prisma.actionItem.findMany({
    where: {
      completed: false,
      OR: [
        { deadline: { lte: targetDate, not: "" } },
        { deadline: "" }
      ]
    },
    orderBy: { createdAt: 'desc' }
  });

  const dailyPlans = await prisma.dailyPlanEntry.findMany({
    where: { date: targetDate },
    orderBy: { startTime: 'asc' }
  });

  return {
    success: true,
    date: targetDate,
    projectsCount,
    openActionItems: actionItems,
    dailyPlans
  };
}

// Tool Definitions for Gemini API
const agentTools = [
  {
    functionDeclarations: [
      {
        name: "listProjects",
        description: "List all active projects in the database."
      },
      {
        name: "listActionItems",
        description: "Get action items, optionally filtered by status, PIC name, project ID, completion, or deadline range.",
        parameters: {
          type: "OBJECT",
          properties: {
            status: { type: "STRING", description: "Filter by status. Use 'open' to match active/incomplete tasks (TO DO, Testing, Open) or 'completed' for finished ones." },
            pic: { type: "STRING", description: "Filter by PIC name (case-insensitive)" },
            projectId: { type: "STRING", description: "Filter by project ID" },
            excludeCompleted: { type: "BOOLEAN", description: "If true, excludes finished tasks. Defaults to true for active task lookups." },
            deadlineStart: { type: "STRING", description: "Start of deadline range in YYYY-MM-DD format" },
            deadlineEnd: { type: "STRING", description: "End of deadline range in YYYY-MM-DD format" }
          }
        }
      },
      {
        name: "createActionItem",
        description: "Create a new action item (task) in the database.",
        parameters: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING", description: "Title of the action item" },
            description: { type: "STRING", description: "Detailed description of the task" },
            deadline: { type: "STRING", description: "Deadline in YYYY-MM-DD format" },
            pic: { type: "STRING", description: "Person in charge (PIC) name" },
            projectId: { type: "STRING", description: "Optional Project ID to link this task to" }
          },
          required: ["title"]
        }
      },
      {
        name: "updateActionItem",
        description: "Update an existing action item's status, details, PIC, or deadline. If ID is unknown, provide title to find it.",
        parameters: {
          type: "OBJECT",
          properties: {
            id: { type: "STRING", description: "The unique ID of the action item" },
            title: { type: "STRING", description: "The title of the action item to search and update if ID is unknown" },
            status: { type: "STRING", description: "New status: 'Pending', 'Open', 'In Progress', 'Selesai'" },
            completed: { type: "BOOLEAN", description: "Whether the task is completed" },
            deadline: { type: "STRING", description: "New deadline in YYYY-MM-DD format" },
            pic: { type: "STRING", description: "New PIC name" },
            description: { type: "STRING", description: "New description" }
          }
        }
      },
      {
        name: "deleteActionItem",
        description: "Delete an action item from the database by ID or title.",
        parameters: {
          type: "OBJECT",
          properties: {
            id: { type: "STRING", description: "The unique ID of the action item" },
            title: { type: "STRING", description: "The title of the action item to delete" }
          }
        }
      },
      {
        name: "listDailyPlans",
        description: "List daily plan entries (agendas, meetings, focus sessions) for a specific date or range.",
        parameters: {
          type: "OBJECT",
          properties: {
            date: { type: "STRING", description: "The target date (YYYY-MM-DD). Defaults to today if not provided." },
            startDate: { type: "STRING", description: "Start date of the range (YYYY-MM-DD)" },
            endDate: { type: "STRING", description: "End date of the range (YYYY-MM-DD)" }
          }
        }
      },
      {
        name: "createDailyPlanEntry",
        description: "Create an agenda item in the daily plan.",
        parameters: {
          type: "OBJECT",
          properties: {
            date: { type: "STRING", description: "The date of the plan (YYYY-MM-DD)" },
            title: { type: "STRING", description: "Title of the agenda entry" },
            startTime: { type: "STRING", description: "Start time in HH:MM format (e.g. '09:00')" },
            endTime: { type: "STRING", description: "End time in HH:MM format (e.g. '10:00')" },
            type: { type: "STRING", description: "Type of entry: 'task', 'meeting', 'focus'" },
            notes: { type: "STRING", description: "Additional details or notes" },
            actionItemId: { type: "STRING", description: "Optional Action Item ID to associate this daily agenda entry with" }
          },
          required: ["date", "title"]
        }
      },
      {
        name: "updateDailyPlanEntry",
        description: "Update status, notes, or time parameters of a daily plan agenda item.",
        parameters: {
          type: "OBJECT",
          properties: {
            id: { type: "STRING", description: "The unique ID of the daily plan entry" },
            title: { type: "STRING", description: "The title of the entry to search and update if ID is unknown" },
            date: { type: "STRING", description: "The date of the entry to search (YYYY-MM-DD)" },
            status: { type: "STRING", description: "New status: 'open', 'in_progress', 'done', 'pending', 'skipped'" },
            startTime: { type: "STRING", description: "New start time (HH:MM)" },
            endTime: { type: "STRING", description: "New end time (HH:MM)" },
            notes: { type: "STRING", description: "New notes content" }
          }
        }
      },
      {
        name: "deleteDailyPlanEntry",
        description: "Delete a daily plan entry by ID or title.",
        parameters: {
          type: "OBJECT",
          properties: {
            id: { type: "STRING", description: "The unique ID of the daily plan entry" },
            title: { type: "STRING", description: "The title of the entry to delete" },
            date: { type: "STRING", description: "The date of the entry (YYYY-MM-DD)" }
          }
        }
      },
      {
        name: "getDailyRecap",
        description: "Get a comprehensive recap of active projects, today's schedule, and open action items.",
        parameters: {
          type: "OBJECT",
          properties: {
            date: { type: "STRING", description: "The date to recap (YYYY-MM-DD). Defaults to today's date." }
          }
        }
      }
    ]
  }
];

export async function handleTelegramAgentMessage(text: string, chatId: string): Promise<string> {
  const apiKey = await getGeminiApiKey();
  const currentDate = new Date().toISOString().split('T')[0];
  const currentDayName = new Date().toLocaleDateString('id-ID', { weekday: 'long' });

  const systemInstruction = `You are the AI Chatbot Agent for SuperPM, a personal project management tool.
The user is Wildan. Today's date is ${currentDate} (${currentDayName}).
Your task is to help Wildan manage projects, action items, and daily plans using the tools provided.

Rules:
1. Always speak in friendly and professional Indonesian. Use terms like "Kak Wildan" or "kamu" to address the user.
2. If the user asks you to perform an action (e.g., create, update, delete, list), select and call the appropriate tool.
3. Be precise with dates. For relative dates like "besok", "lusa", "kemarin", convert them to YYYY-MM-DD format. Today's date is ${currentDate}.
4. If a tool requires an ID (like update or delete) and you do not have it, try searching by title using the search parameters in the tool, or query the items first.
5. Provide helpful and formatted markdown responses. Present lists as bullet points or tables.
6. If the user asks a general question unrelated to database operations, answer directly without calling any tools.
7. Be proactive: if a task is updated or created, summarize the details nicely.
8. If the database response is empty or errors, explain it clearly to the user in a friendly way.
9. IMPORTANT: The database contains tasks synced from Jira using statuses like 'TO DO', 'Testing', 'Done' as well as manual tasks using 'Open', 'Pending', 'In Progress', 'Selesai'. When the user asks for open/active tasks (e.g., 'ada task apa saja'), set excludeCompleted=true and DO NOT filter by status='open' unless explicitly asked, as this will filter out Jira's 'TO DO' and 'Testing' tasks. When displaying tasks, show their actual status from the database.`;

  // Start chat session with user input
  const contents: any[] = [
    {
      role: 'user',
      parts: [{ text }]
    }
  ];

  const maxIterations = 5;
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;
    // Use gemini-3.1-flash-lite as requested by user based on AI Studio limits (500 RPD)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

    const requestBody = {
      contents,
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      tools: agentTools
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Agent Error:', errorText);
      throw new Error(`Failed to communicate with Gemini Agent API: ${response.statusText}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const message = candidate?.content;

    if (!message) {
      throw new Error('Gemini Agent returned an empty candidate.');
    }

    // Add model output to history
    contents.push(message);

    const parts = message.parts || [];
    const functionCalls = parts.filter((p: any) => p.functionCall);

    if (functionCalls.length === 0) {
      // No more function calls, return the final text response
      const textResponse = parts.map((p: any) => p.text).filter(Boolean).join('\n');
      return textResponse || 'Maaf, saya tidak bisa menghasilkan respon.';
    }

    // Execute function calls
    const functionResponsesParts: any[] = [];

    for (const call of functionCalls) {
      const { name, args } = call.functionCall;
      console.log(`Executing tool: ${name} with args:`, args);

      let result: any;
      try {
        switch (name) {
          case 'listProjects':
            result = await executeListProjects();
            break;
          case 'listActionItems':
            result = await executeListActionItems(
              args.status,
              args.pic,
              args.projectId,
              args.excludeCompleted,
              args.deadlineStart,
              args.deadlineEnd
            );
            break;
          case 'createActionItem':
            result = await executeCreateActionItem(args.title, args.description, args.deadline, args.pic, args.projectId);
            break;
          case 'updateActionItem':
            result = await executeUpdateActionItem(args.id, args.title, args.status, args.completed, args.deadline, args.pic, args.description);
            break;
          case 'deleteActionItem':
            result = await executeDeleteActionItem(args.id, args.title);
            break;
          case 'listDailyPlans':
            result = await executeListDailyPlans(args.date, args.startDate, args.endDate);
            break;
          case 'createDailyPlanEntry':
            result = await executeCreateDailyPlanEntry(args.date, args.title, args.startTime, args.endTime, args.type, args.notes, args.actionItemId);
            break;
          case 'updateDailyPlanEntry':
            result = await executeUpdateDailyPlanEntry(args.id, args.title, args.date, args.status, args.startTime, args.endTime, args.notes);
            break;
          case 'deleteDailyPlanEntry':
            result = await executeDeleteDailyPlanEntry(args.id, args.title, args.date);
            break;
          case 'getDailyRecap':
            result = await executeGetDailyRecap(args.date);
            break;
          default:
            result = { success: false, error: `Tool ${name} not found.` };
        }
      } catch (err: any) {
        console.error(`Error executing tool ${name}:`, err);
        result = { success: false, error: err.message || 'Internal database error' };
      }

      functionResponsesParts.push({
        functionResponse: {
          name,
          response: result
        }
      });
    }

    // Append function response to history
    contents.push({
      role: 'function',
      parts: functionResponsesParts
    });
  }

  return 'Maaf, saya terlalu banyak memproses langkah. Harap coba persingkat perintah Anda.';
}
