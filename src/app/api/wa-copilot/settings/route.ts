import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyCapability } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyCapability(request, 'view_settings');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const setting = await prisma.systemSetting.findUnique({
      where: { id: 'default' }
    });

    const defaultStatuses = ["Pending", "Open", "In Progress", "Selesai"];
    const defaultJiraStatuses = ["To Do", "In Progress", "Done"];
    const responseData = setting ? {
      ...setting,
      actionItemStatuses: setting.actionItemStatuses && setting.actionItemStatuses.length > 0
        ? setting.actionItemStatuses
        : defaultStatuses,
      jiraSyncStatuses: setting.jiraSyncStatuses && setting.jiraSyncStatuses.length > 0
        ? setting.jiraSyncStatuses
        : defaultJiraStatuses,
      jiraSyncDaysBack: setting.jiraSyncDaysBack !== undefined && setting.jiraSyncDaysBack !== null
        ? setting.jiraSyncDaysBack
        : 30,
      jiraSyncMaxResults: setting.jiraSyncMaxResults !== undefined && setting.jiraSyncMaxResults !== null
        ? setting.jiraSyncMaxResults
        : 500
    } : {
      id: 'default',
      tgBotName: '',
      tgBotToken: '',
      tgBotPin: '1234',
      geminiApiKey: '',
      appUrl: 'https://pm-super-tools.vercel.app',
      jiraUrl: '',
      jiraEmail: '',
      jiraToken: '',
      actionItemStatuses: defaultStatuses,
      jiraSyncStatuses: defaultJiraStatuses,
      jiraSyncDaysBack: 30,
      jiraSyncMaxResults: 500
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyCapability(request, 'manage_settings');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const body = await request.json();
    const finalAppUrl = body.appUrl || 'https://pm-super-tools.vercel.app';
    
    // Save settings (Upsert)
    const updatedSetting = await prisma.systemSetting.upsert({
      where: { id: 'default' },
      update: {
        tgBotName: body.tgBotName || '',
        tgBotToken: body.tgBotToken || '',
        tgBotPin: body.tgBotPin || '1234',
        geminiApiKey: body.geminiApiKey || '',
        appUrl: finalAppUrl,
        jiraUrl: body.jiraUrl || '',
        jiraEmail: body.jiraEmail || '',
        jiraToken: body.jiraToken || '',
        actionItemStatuses: body.actionItemStatuses || undefined,
        jiraSyncStatuses: body.jiraSyncStatuses || undefined,
        jiraSyncDaysBack: body.jiraSyncDaysBack !== undefined ? Number(body.jiraSyncDaysBack) : undefined,
        jiraSyncMaxResults: body.jiraSyncMaxResults !== undefined ? Number(body.jiraSyncMaxResults) : undefined
      },
      create: {
        id: 'default',
        tgBotName: body.tgBotName || '',
        tgBotToken: body.tgBotToken || '',
        tgBotPin: body.tgBotPin || '1234',
        geminiApiKey: body.geminiApiKey || '',
        appUrl: finalAppUrl,
        jiraUrl: body.jiraUrl || '',
        jiraEmail: body.jiraEmail || '',
        jiraToken: body.jiraToken || '',
        actionItemStatuses: body.actionItemStatuses || ["Pending", "Open", "In Progress", "Selesai"],
        jiraSyncStatuses: body.jiraSyncStatuses || ["To Do", "In Progress", "Done"],
        jiraSyncDaysBack: body.jiraSyncDaysBack !== undefined ? Number(body.jiraSyncDaysBack) : 30,
        jiraSyncMaxResults: body.jiraSyncMaxResults !== undefined ? Number(body.jiraSyncMaxResults) : 500
      }
    });

    let webhookRegistered = false;
    let webhookError = '';

    // If bot token and app URL are set, register the webhook with Telegram
    if (updatedSetting.tgBotToken && updatedSetting.appUrl) {
      try {
        // Clean URL trailing slashes and construct webhook URL
        const cleanAppUrl = updatedSetting.appUrl.replace(/\/+$/, '');
        const webhookUrl = `${cleanAppUrl}/api/telegram-webhook`;
        
        const tgUrl = `https://api.telegram.org/bot${updatedSetting.tgBotToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
        
        const tgRes = await fetch(tgUrl, { method: 'POST' });
        const tgData = await tgRes.json();
        
        if (tgRes.ok && tgData.ok) {
          webhookRegistered = true;
        } else {
          webhookError = tgData.description || 'Unknown Telegram error';
        }
      } catch (err: any) {
        console.error('Failed to register Telegram webhook:', err);
        webhookError = err.message || 'Network error';
      }
    }

    return NextResponse.json({
      success: true,
      setting: updatedSetting,
      webhookRegistered,
      webhookError: webhookRegistered ? null : webhookError
    });
  } catch (error: any) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: error.message || 'Failed to save settings' }, { status: 500 });
  }
}
