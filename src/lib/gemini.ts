import { prisma } from './prisma';

export interface ExtractedActionItem {
  title: string;
  description?: string;
  pic?: string;
  deadline?: string;
}

export interface ExtractedDecision {
  summary: string;
  decided_by?: string;
}

export interface ExtractedBlocker {
  issue: string;
  impact?: string;
  severity?: 'low' | 'medium' | 'high';
}

export interface GeminiExtractionResult {
  action_items: ExtractedActionItem[];
  decisions: ExtractedDecision[];
  blockers: ExtractedBlocker[];
}

/**
 * Resolves the Gemini API Key from database settings or environment variables.
 */
export async function getGeminiApiKey(): Promise<string> {
  const setting = await prisma.systemSetting.findUnique({
    where: { id: 'default' }
  });
  
  if (setting?.geminiApiKey) {
    return setting.geminiApiKey;
  }
  
  const envKey = process.env.GEMINI_API_KEY;
  if (envKey) {
    return envKey;
  }
  
  throw new Error('Gemini API Key is not configured. Please set it in Settings.');
}

/**
 * Calls Gemini API to extract structured action items, decisions, and blockers.
 */
export async function extractInsightsFromChat(chatText: string): Promise<GeminiExtractionResult> {
  const apiKey = await getGeminiApiKey();
  const currentDate = new Date().toISOString().split('T')[0];

  const systemPrompt = `You are the AI Engine of SuperPM, an intelligent companion for Product Managers.
Your job is to analyze WhatsApp chat transcripts and extract structured project management insights.

Analyze the chat history and extract the following:
1. Action Items: Tasks that need to be done. Must have a clear title, assignee (PIC), and deadline (if mentioned).
2. Decisions: Agreements, scope definitions, or consensus made by the participants.
3. Blockers: Issues, risks, dependencies, or blockers that impede project progress.

Rules:
- Assignee: If the chat context suggests a person is responsible, put their name in 'pic'.
- Deadline: Convert relative dates (e.g. "besok", "senin depan", "minggu depan", "lusa", "akhir bulan") to YYYY-MM-DD. Reference: Current date is ${currentDate}.
- Keep descriptions concise.
- Preserve any customer/client name context if present.
- If there are no items of a specific type, return an empty array.
- IMPORTANT: Return output in JSON format matching the schema exactly.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: `${systemPrompt}\n\nChat Transcript:\n"""\n${chatText}\n"""`
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          action_items: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                title: { type: 'STRING' },
                description: { type: 'STRING' },
                pic: { type: 'STRING' },
                deadline: { type: 'STRING' }
              },
              required: ['title']
            }
          },
          decisions: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                summary: { type: 'STRING' },
                decided_by: { type: 'STRING' }
              },
              required: ['summary']
            }
          },
          blockers: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                issue: { type: 'STRING' },
                impact: { type: 'STRING' },
                severity: { type: 'STRING', enum: ['low', 'medium', 'high'] }
              },
              required: ['issue']
            }
          }
        },
        required: ['action_items', 'decisions', 'blockers']
      }
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Gemini API Error Response:', errorBody);
    throw new Error(`Gemini API call failed: ${response.statusText} (${response.status})`);
  }

  const data = await response.json();
  const contentText = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!contentText) {
    throw new Error('Gemini API returned an empty response');
  }

  try {
    return JSON.parse(contentText) as GeminiExtractionResult;
  } catch (error) {
    console.error('Failed to parse Gemini output:', contentText);
    throw new Error('Gemini output was not valid JSON matching the schema');
  }
}
