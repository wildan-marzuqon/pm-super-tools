import fs from 'fs';
import path from 'path';

// Define Types
export interface Note {
  id: string;
  title: string;
  content: string; // HTML or Markdown formatted string
  folder: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  deadline: string;
  pic: string;
  status: 'open' | 'in_progress' | 'done';
  source_note_id?: string;
  project_id?: string;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  deadline: string;
  pic: string;
  current_stage_index: number;
  created_at: string;
}

export interface ProjectStage {
  id: string;
  project_id: string;
  name: string;
  order: number; // 0-indexed
  completed_at?: string; // If present, stage is completed
}

export interface Artifact {
  id: string;
  project_id: string;
  label: string;
  url: string;
  description: string;
}

export interface DbSchema {
  notes: Note[];
  action_items: ActionItem[];
  projects: Project[];
  project_stages: ProjectStage[];
  artifacts: Artifact[];
}

const DB_FILE_PATH = path.join(process.cwd(), 'data', 'db.json');

// Helper to ensure data directory exists and DB file exists
function initializeDb() {
  const dirPath = path.dirname(DB_FILE_PATH);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE_PATH)) {
    // Write initial dummy data
    const initialData: DbSchema = {
      notes: [
        {
          id: 'note-1',
          title: 'Meeting POC dengan Tim AI Devs',
          content: '<h3>Agenda POC</h3><p>Rapat kickoff untuk penentuan performa model AI.</p><ul><li><input type="checkbox" checked id="chk-1"> Tentukan baseline model Llama-3-8B</li><li><input type="checkbox" id="chk-2"> Deploy mock API endpoint untuk pengetesan latensi</li><li><input type="checkbox" id="chk-3"> Siapkan dataset evaluasi (100 sample test-case)</li></ul><p>Tolong dideploy minggu ini agar tim frontend bisa langsung integrasi.</p>',
          folder: 'Work',
          tags: ['AI', 'POC', 'Meeting'],
          created_at: new Date(Date.now() - 3600000 * 24).toISOString(), // 1 day ago
          updated_at: new Date(Date.now() - 3600000 * 2).toISOString()
        },
        {
          id: 'note-2',
          title: 'Feedback UI/UX Project Tracker',
          content: '<h3>Catatan Desain</h3><p>Berikut feedback dari user testing:</p><ul><li><input type="checkbox" checked id="chk-4"> Ganti tampilan pipeline model kanban jadi model tab step-by-step horizontal</li><li><input type="checkbox" id="chk-5"> Tambahkan kustomisasi stage per project</li><li><input type="checkbox" id="chk-6"> Nuansa warna diganti putih kuning hangat</li></ul>',
          folder: 'Design',
          tags: ['UI', 'UX', 'Feedback'],
          created_at: new Date(Date.now() - 3600000 * 12).toISOString(), // 12 hours ago
          updated_at: new Date(Date.now() - 3600000 * 12).toISOString()
        }
      ],
      action_items: [
        {
          id: 'action-1',
          title: 'Tentukan baseline model Llama-3-8B',
          description: 'Lakukan benchmarking awal untuk akurasi dan kecepatan inferensi.',
          deadline: '2026-06-22',
          pic: 'Rian',
          status: 'done',
          source_note_id: 'note-1',
          project_id: 'proj-1',
          created_at: new Date(Date.now() - 3600000 * 24).toISOString()
        },
        {
          id: 'action-2',
          title: 'Deploy mock API endpoint untuk pengetesan latensi',
          description: 'Deploy di Vercel/AWS Lambda untuk testing latensi dari client side.',
          deadline: '2026-06-25',
          pic: 'Adi',
          status: 'open',
          source_note_id: 'note-1',
          project_id: 'proj-1',
          created_at: new Date(Date.now() - 3600000 * 24).toISOString()
        },
        {
          id: 'action-3',
          title: 'Ganti tampilan pipeline model kanban jadi model tab step-by-step horizontal',
          description: 'Hapus drag and drop, gantikan dengan tab indicator yang lebih clean.',
          deadline: '2026-06-24',
          pic: 'Ferry',
          status: 'done',
          source_note_id: 'note-2',
          project_id: 'proj-2',
          created_at: new Date(Date.now() - 3600000 * 12).toISOString()
        },
        {
          id: 'action-4',
          title: 'Tambahkan kustomisasi stage per project',
          description: 'Buat setting di project detail untuk manage stages list.',
          deadline: '2026-06-26',
          pic: 'Wildan',
          status: 'in_progress',
          source_note_id: 'note-2',
          project_id: 'proj-2',
          created_at: new Date(Date.now() - 3600000 * 12).toISOString()
        }
      ],
      projects: [
        {
          id: 'proj-1',
          name: 'Rekomendasi Produk AI v2',
          description: 'Pengembangan sistem rekomendasi personalisasi berbasis user behavior menggunakan model hybrid.',
          deadline: '2026-07-20',
          pic: 'Wildan',
          current_stage_index: 1, // POC stage
          created_at: new Date(Date.now() - 3600000 * 24 * 5).toISOString()
        },
        {
          id: 'proj-2',
          name: 'PM Super Tools Workspace',
          description: 'Platform personal note-taking dan project tracker ringkas untuk meningkatkan produktivitas PM.',
          deadline: '2026-07-05',
          pic: 'Wildan',
          current_stage_index: 2, // Kick Off stage
          created_at: new Date(Date.now() - 3600000 * 24 * 3).toISOString()
        }
      ],
      project_stages: [
        // Project 1 stages
        { id: 'stage-1-1', project_id: 'proj-1', name: 'Ideation', order: 0, completed_at: new Date(Date.now() - 3600000 * 24 * 4).toISOString() },
        { id: 'stage-1-2', project_id: 'proj-1', name: 'POC', order: 1 },
        { id: 'stage-1-3', project_id: 'proj-1', name: 'Kick Off', order: 2 },
        { id: 'stage-1-4', project_id: 'proj-1', name: 'Implementation', order: 3 },
        { id: 'stage-1-5', project_id: 'proj-1', name: 'Live', order: 4 },

        // Project 2 stages
        { id: 'stage-2-1', project_id: 'proj-2', name: 'Ideation', order: 0, completed_at: new Date(Date.now() - 3600000 * 24 * 2).toISOString() },
        { id: 'stage-2-2', project_id: 'proj-2', name: 'POC', order: 1, completed_at: new Date(Date.now() - 3600000 * 24 * 1).toISOString() },
        { id: 'stage-2-3', project_id: 'proj-2', name: 'Kick Off', order: 2 },
        { id: 'stage-2-4', project_id: 'proj-2', name: 'Implementation', order: 3 },
        { id: 'stage-2-5', project_id: 'proj-2', name: 'Live', order: 4 }
      ],
      artifacts: [
        {
          id: 'art-1',
          project_id: 'proj-1',
          label: 'Google Drive - POC Dataset',
          url: 'https://drive.google.com/drive/folders/dummy-poc-dataset-url',
          description: 'Dataset evaluasi 100 sample data dummy transaksi user.'
        },
        {
          id: 'art-2',
          project_id: 'proj-2',
          label: 'Figma - UI Design Design System',
          url: 'https://figma.com/file/dummy-workspace-ui-design-url',
          description: 'Sistem desain untuk warna putih-kuning hangat.'
        }
      ]
    };
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(initialData, null, 2), 'utf-8');
  }
}

// Read database
export function readDb(): DbSchema {
  initializeDb();
  try {
    const dataStr = fs.readFileSync(DB_FILE_PATH, 'utf-8');
    return JSON.parse(dataStr);
  } catch (error) {
    console.error('Error reading local JSON database:', error);
    return { notes: [], action_items: [], projects: [], project_stages: [], artifacts: [] };
  }
}

// Write database
export function writeDb(data: DbSchema): void {
  initializeDb();
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing local JSON database:', error);
  }
}
