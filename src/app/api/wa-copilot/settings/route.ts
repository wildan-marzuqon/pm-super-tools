import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { id: 'default' }
    });

    const defaultStatuses = ["Pending", "Open", "In Progress", "Selesai"];
    const responseData = setting ? {
      ...setting,
      actionItemStatuses: setting.actionItemStatuses && setting.actionItemStatuses.length > 0
        ? setting.actionItemStatuses
        : defaultStatuses
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
      actionItemStatuses: defaultStatuses
    };

    return Response.json(responseData);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return Response.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
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
        actionItemStatuses: body.actionItemStatuses || undefined
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
        actionItemStatuses: body.actionItemStatuses || ["Pending", "Open", "In Progress", "Selesai"]
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

    return Response.json({
      success: true,
      setting: updatedSetting,
      webhookRegistered,
      webhookError: webhookRegistered ? null : webhookError
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return Response.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
