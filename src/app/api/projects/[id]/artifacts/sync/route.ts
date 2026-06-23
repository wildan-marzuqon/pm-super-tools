import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

function extractFolderId(url: string): string | null {
  const match = url.match(/\/folders\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  const matchQuery = url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  if (matchQuery) return matchQuery[1];
  return null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // Find project
    const project = await prisma.project.findUnique({
      where: { id }
    });

    if (!project) {
      return Response.json({ error: 'Proyek tidak ditemukan' }, { status: 404 });
    }

    if (!project.googleDriveFolderUrl) {
      return Response.json({ 
        error: 'Folder Google Drive belum dikonfigurasi di Settings & Stages proyek.' 
      }, { status: 400 });
    }

    const folderId = extractFolderId(project.googleDriveFolderUrl);
    if (!folderId) {
      return Response.json({ 
        error: 'Format URL Folder Google Drive tidak valid. Pastikan link berisi ID folder.' 
      }, { status: 400 });
    }

    // Determine if we should run in demo/mock mode
    const runDemo = body.demo === true;

    let filesToInsert = [];

    if (runDemo) {
      // Generate mock files for demo
      filesToInsert = [
        {
          name: '[Demo] PRD - Chatbot Helpdesk ADMF (Fase 1).gdoc',
          url: 'https://docs.google.com/document/d/dummy-prd-id',
          mimeType: 'application/vnd.google-apps.document'
        },
        {
          name: '[Demo] UAT Test Cases & Feedback.gsheet',
          url: 'https://docs.google.com/spreadsheets/d/dummy-feedback-id',
          mimeType: 'application/vnd.google-apps.spreadsheet'
        },
        {
          name: '[Demo] User Persona & Wireframe.gslides',
          url: 'https://docs.google.com/presentation/d/dummy-presentation-id',
          mimeType: 'application/vnd.google-apps.presentation'
        },
        {
          name: '[Demo] Database Schema Diagram.png',
          url: 'https://drive.google.com/file/d/dummy-img-id',
          mimeType: 'image/png'
        },
        {
          name: '[Demo] Project Roadmap Timeline.gsheet',
          url: 'https://docs.google.com/spreadsheets/d/dummy-roadmap-id',
          mimeType: 'application/vnd.google-apps.spreadsheet'
        }
      ];
    } else {
      // Real sync mode
      if (!project.googleApiKey) {
        return Response.json({ 
          code: 'MISSING_API_KEY',
          error: 'Google API Key belum dikonfigurasi di Settings & Stages proyek.' 
        }, { status: 400 });
      }

      // Call Google Drive API
      const driveApiUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,webViewLink)&key=${project.googleApiKey}`;
      
      const gres = await fetch(driveApiUrl);
      if (!gres.ok) {
        const errorDetails = await gres.json().catch(() => ({}));
        console.error('Google API error:', errorDetails);
        return Response.json({ 
          error: 'Gagal mengambil file dari Google Drive. Pastikan folder diset publik ("Anyone with the link can view") dan Google API Key Anda valid.' 
        }, { status: 400 });
      }

      const data = await gres.json();
      const files = data.files || [];

      filesToInsert = files.map((file: any) => ({
        name: file.name,
        url: file.webViewLink || `https://drive.google.com/open?id=${file.id}`,
        mimeType: file.mimeType
      }));
    }

    // Run delete and insert in a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Delete all existing synced artifacts
      await tx.artifact.deleteMany({
        where: {
          projectId: id,
          isSynced: true
        }
      });

      // 2. Insert new synced artifacts
      if (filesToInsert.length > 0) {
        await tx.artifact.createMany({
          data: filesToInsert.map((file: any) => {
            const shortMime = file.mimeType.split('.').pop() || 'file';
            let cleanType = 'file';
            if (file.mimeType.includes('document')) cleanType = 'document';
            else if (file.mimeType.includes('spreadsheet')) cleanType = 'spreadsheet';
            else if (file.mimeType.includes('presentation')) cleanType = 'presentation';
            
            return {
              projectId: id,
              label: file.name,
              url: file.url,
              description: `File disinkronisasi dari Google Drive (${cleanType})`,
              isSynced: true,
              type: 'link'
            };
          })
        });
      }
    });

    return Response.json({ success: true, count: filesToInsert.length });
  } catch (error) {
    console.error('Error syncing artifacts:', error);
    return Response.json({ error: 'Gagal menyinkronkan folder Google Drive.' }, { status: 500 });
  }
}
