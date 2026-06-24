import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseWhatsAppZip, filterChatByDate } from '@/lib/zip-parser';
import { anonymize, deanonymize } from '@/lib/anonymizer';
import { extractInsightsFromChat } from '@/lib/gemini';

// Helper to send messages to Telegram
async function sendTelegramMessage(token: string, chatId: string, text: string, replyMarkup?: any) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: replyMarkup
    })
  });
}

// Helper to answer Telegram callback queries
async function answerCallbackQuery(token: string, callbackQueryId: string, text?: string) {
  const url = `https://api.telegram.org/bot${token}/answerCallbackQuery`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text
    })
  });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    console.log('Received Telegram payload:', JSON.stringify(payload));

    // Get system settings for bot token
    const setting = await prisma.systemSetting.findUnique({
      where: { id: 'default' }
    });

    if (!setting || !setting.tgBotToken) {
      console.error('Telegram bot token not configured in system settings.');
      return Response.json({ ok: false, error: 'Bot token not configured' });
    }

    const token = setting.tgBotToken;
    const botPin = setting.tgBotPin;

    // Handle Callback Query (inline keyboard button clicks)
    if (payload.callback_query) {
      const callbackQuery = payload.callback_query;
      const chatId = String(callbackQuery.message.chat.id);
      const callbackData = callbackQuery.data;
      const callbackQueryId = callbackQuery.id;

      // Check if session is authorized
      const session = await prisma.telegramSession.findUnique({
        where: { chatId }
      });

      if (!session || !session.isAuthorized) {
        await answerCallbackQuery(token, callbackQueryId, 'Session not authorized');
        await sendTelegramMessage(token, chatId, 'Sesi Anda belum ter-otorisasi. Kirim PIN Anda terlebih dahulu.');
        return Response.json({ ok: true });
      }

      if (callbackData.startsWith('process_date:')) {
        const selectedDate = callbackData.replace('process_date:', '');
        await answerCallbackQuery(token, callbackQueryId, `Memproses tanggal ${selectedDate}...`);

        await sendTelegramMessage(token, chatId, `Memfilter log obrolan untuk tanggal ${selectedDate} dan menganalisis dengan AI... ⏳`);

        // Fetch pending file
        const pendingFile = await prisma.wAPendingFile.findUnique({
          where: { chatId }
        });

        if (!pendingFile) {
          await sendTelegramMessage(token, chatId, 'Gagal menemukan berkas obrolan tertunda. Silakan unggah ZIP baru.');
          return Response.json({ ok: true });
        }

        try {
          // 1. Filter chat content
          const filteredChat = filterChatByDate(pendingFile.fileContent, selectedDate);
          
          if (!filteredChat.trim()) {
            await sendTelegramMessage(token, chatId, 'Tidak ditemukan pesan pada tanggal terpilih.');
            return Response.json({ ok: true });
          }

          // 2. Anonymize chat content
          const { anonymizedText, map } = anonymize(filteredChat);

          // 3. Call AI
          const aiResult = await extractInsightsFromChat(anonymizedText);

          // 4. De-anonymize and save drafts
          const draftIds: string[] = [];

          // Save Action Items
          for (const item of aiResult.action_items) {
            const draft = await prisma.wACopilotDraft.create({
              data: {
                type: 'action_item',
                title: deanonymize(item.title, map),
                description: deanonymize(item.description || '', map),
                pic: deanonymize(item.pic || '', map),
                deadline: item.deadline || '',
                rawChat: filteredChat
              }
            });
            draftIds.push(draft.id);
          }

          // Save Decisions
          for (const item of aiResult.decisions) {
            const draft = await prisma.wACopilotDraft.create({
              data: {
                type: 'decision',
                title: deanonymize(item.summary, map),
                description: deanonymize(item.decided_by || '', map), // Use description for decided_by context
                rawChat: filteredChat
              }
            });
            draftIds.push(draft.id);
          }

          // Save Blockers
          for (const item of aiResult.blockers) {
            const draft = await prisma.wACopilotDraft.create({
              data: {
                type: 'blocker',
                title: deanonymize(item.issue, map),
                description: [
                  item.impact ? `Dampak: ${deanonymize(item.impact, map)}` : '',
                  `Keparahan: ${item.severity || 'medium'}`
                ].filter(Boolean).join('\n'),
                rawChat: filteredChat
              }
            });
            draftIds.push(draft.id);
          }

          // Delete pending file cache
          await prisma.wAPendingFile.delete({
            where: { chatId }
          });

          // Generate app link
          const appUrl = setting.appUrl ? setting.appUrl.replace(/\/+$/, '') : 'http://localhost:3000';
          const reviewUrl = `${appUrl}/wa-copilot?drafts=${draftIds.join(',')}`;

          // Reply with summary
          const summaryMessage = `Draf berhasil diekstrak! 📝\n\n` +
            `• Action Items: ${aiResult.action_items.length} draf\n` +
            `• Keputusan: ${aiResult.decisions.length} draf\n` +
            `• Blocker/Risiko: ${aiResult.blockers.length} draf\n\n` +
            `Silakan tinjau dan publish draf tersebut di dashboard web:\n👉 ${reviewUrl}`;

          await sendTelegramMessage(token, chatId, summaryMessage);

        } catch (err: any) {
          console.error('Error during AI analysis:', err);
          await sendTelegramMessage(token, chatId, `Gagal memproses AI: ${err.message || 'Error tidak diketahui'}`);
        }
      } else if (callbackData === 'cancel') {
        await answerCallbackQuery(token, callbackQueryId, 'Dibatalkan');
        
        await prisma.wAPendingFile.deleteMany({
          where: { chatId }
        });

        await sendTelegramMessage(token, chatId, 'Proses dibatalkan. Silakan kirim berkas ZIP baru kapan saja.');
      }

      return Response.json({ ok: true });
    }

    // Handle normal text and file uploads
    const message = payload.message;
    if (!message) {
      return Response.json({ ok: true });
    }

    const chatId = String(message.chat.id);
    const text = message.text || '';

    // Fetch or create Telegram Session
    let session = await prisma.telegramSession.findUnique({
      where: { chatId }
    });

    if (!session) {
      session = await prisma.telegramSession.create({
        data: { chatId, isAuthorized: false }
      });
    }

    // 1. PIN Authentication
    if (!session.isAuthorized) {
      if (text === botPin) {
        await prisma.telegramSession.update({
          where: { chatId },
          data: { isAuthorized: true }
        });
        await sendTelegramMessage(token, chatId, 'Otorisasi sukses! 🔓\nSelamat datang di SuperPM AI Copilot Bot. Silakan kirimkan file ZIP ekspor obrolan WhatsApp Anda.');
      } else {
        await sendTelegramMessage(token, chatId, 'Akses dibatasi. Silakan masukkan PIN keamanan Anda untuk membuka akses:');
      }
      return Response.json({ ok: true });
    }

    // 2. Handle standard commands
    if (text === '/start' || text === '/help') {
      const welcomeText = `Halo! Saya SuperPM AI Copilot Bot. ⚡\n\n` +
        `Cara penggunaan:\n` +
        `1. Masuk ke WhatsApp (HP Anda)\n` +
        `2. Buka chat/grup -> Klik menu -> Ekspor Obrolan (Export Chat) -> Tanpa Media (Without Media).\n` +
        `3. Kirim file .zip hasil ekspor tersebut ke bot ini.\n` +
        `4. Bot akan mengekstrak berkas, menampilkan daftar tanggal unik, dan membiarkan Anda memilih hari apa yang ingin dianalisis.\n\n` +
        `Command:\n` +
        `/logout - Mengunci akses bot kembali\n` +
        `/help - Menampilkan panduan ini`;
      await sendTelegramMessage(token, chatId, welcomeText);
      return Response.json({ ok: true });
    }

    if (text === '/logout') {
      await prisma.telegramSession.update({
        where: { chatId },
        data: { isAuthorized: false }
      });
      await sendTelegramMessage(token, chatId, 'Akses Anda berhasil ditutup. Kirim PIN Anda untuk login kembali.');
      return Response.json({ ok: true });
    }

    // 3. Handle Document Upload (.zip)
    if (message.document) {
      const doc = message.document;
      
      if (!doc.file_name?.endsWith('.zip')) {
        await sendTelegramMessage(token, chatId, 'Format berkas tidak valid. Harap kirimkan berkas ekspor obrolan WhatsApp dalam format ZIP (.zip).');
        return Response.json({ ok: true });
      }

      await sendTelegramMessage(token, chatId, 'Mengunduh berkas ZIP chat... 📥');

      try {
        // Fetch file path from Telegram
        const fileUrl = `https://api.telegram.org/bot${token}/getFile?file_id=${doc.file_id}`;
        const fileRes = await fetch(fileUrl);
        const fileData = await fileRes.json();

        if (!fileRes.ok || !fileData.ok) {
          throw new Error(fileData.description || 'Gagal mengambil detail file dari Telegram');
        }

        const filePath = fileData.result.file_path;
        
        // Download raw zip buffer
        const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
        const downloadRes = await fetch(downloadUrl);
        
        if (!downloadRes.ok) {
          throw new Error('Gagal mengunduh file dari server Telegram');
        }

        const zipArrayBuffer = await downloadRes.arrayBuffer();
        const zipBuffer = Buffer.from(zipArrayBuffer);

        // Parse Zip using our zip-parser helper
        await sendTelegramMessage(token, chatId, 'Membaca berkas ZIP dan mengurai log chat... ⚙️');
        const extracted = parseWhatsAppZip(zipBuffer);

        if (extracted.uniqueDates.length === 0) {
          await sendTelegramMessage(token, chatId, 'Tidak ditemukan log percakapan dengan format tanggal yang valid di berkas ekspor Anda.');
          return Response.json({ ok: true });
        }

        // Cache file content to Database
        await prisma.wAPendingFile.upsert({
          where: { chatId },
          update: {
            fileName: extracted.fileName,
            fileContent: extracted.content,
            dates: extracted.uniqueDates,
            createdAt: new Date()
          },
          create: {
            chatId,
            fileName: extracted.fileName,
            fileContent: extracted.content,
            dates: extracted.uniqueDates
          }
        });

        // Present up to top 5 unique dates
        const dateButtons = extracted.uniqueDates.slice(0, 5).map(date => {
          return [{ text: date, callback_data: `process_date:${date}` }];
        });

        // Add Cancel button
        dateButtons.push([{ text: '❌ Batalkan', callback_data: 'cancel' }]);

        const keyboard = {
          inline_keyboard: dateButtons
        };

        await sendTelegramMessage(
          token,
          chatId,
          `Berkas ZIP "${doc.file_name}" berhasil diproses!\n` +
          `Ditemukan total ${extracted.uniqueDates.length} hari percakapan.\n\n` +
          `Silakan pilih tanggal percakapan yang ingin Anda ekstrak insight-nya:`,
          keyboard
        );

      } catch (err: any) {
        console.error('Error handling zip upload:', err);
        await sendTelegramMessage(token, chatId, `Gagal memproses berkas ZIP: ${err.message || 'Error tidak diketahui'}`);
      }

      return Response.json({ ok: true });
    }

    // Default response for unhandled input
    await sendTelegramMessage(token, chatId, 'Input tidak dikenal. Harap kirimkan berkas ekspor obrolan WhatsApp (.zip) atau gunakan command /help.');
    return Response.json({ ok: true });

  } catch (error) {
    console.error('Error inside Telegram Webhook:', error);
    // Return HTTP 200 to Telegram so it doesn't retry looping failed payloads
    return Response.json({ ok: true, error: 'Internal Server Error' });
  }
}
