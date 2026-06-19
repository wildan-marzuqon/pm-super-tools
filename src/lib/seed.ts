import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing database...');
  // Delete in order to satisfy foreign key constraints
  await prisma.artifact.deleteMany();
  await prisma.actionItem.deleteMany();
  await prisma.projectStage.deleteMany();
  await prisma.project.deleteMany();
  await prisma.note.deleteMany();

  console.log('Seeding Notes...');
  const note1 = await prisma.note.create({
    data: {
      id: 'note-1',
      title: 'Meeting POC dengan Tim AI Devs',
      content: '<h3>Agenda POC</h3><p>Rapat kickoff untuk penentuan performa model AI.</p><ul><li><input type="checkbox" checked id="chk-1"> Tentukan baseline model Llama-3-8B</li><li><input type="checkbox" id="chk-2"> Deploy mock API endpoint untuk pengetesan latensi</li><li><input type="checkbox" id="chk-3"> Siapkan dataset evaluasi (100 sample test-case)</li></ul><p>Tolong dideploy minggu ini agar tim frontend bisa langsung integrasi.</p>',
      folder: 'Work',
      tags: ['AI', 'POC', 'Meeting'],
      createdAt: new Date(Date.now() - 3600000 * 24),
      updatedAt: new Date(Date.now() - 3600000 * 2)
    }
  });

  const note2 = await prisma.note.create({
    data: {
      id: 'note-2',
      title: 'Feedback UI/UX Project Tracker',
      content: '<h3>Catatan Desain</h3><p>Berikut feedback dari user testing:</p><ul><li><input type="checkbox" checked id="chk-4"> Ganti tampilan pipeline model kanban jadi model tab step-by-step horizontal</li><li><input type="checkbox" id="chk-5"> Tambahkan kustomisasi stage per project</li><li><input type="checkbox" id="chk-6"> Nuansa warna diganti putih kuning hangat</li></ul>',
      folder: 'Design',
      tags: ['UI', 'UX', 'Feedback'],
      createdAt: new Date(Date.now() - 3600000 * 12),
      updatedAt: new Date(Date.now() - 3600000 * 12)
    }
  });

  console.log('Seeding Projects...');
  const proj1 = await prisma.project.create({
    data: {
      id: 'proj-1',
      name: 'Rekomendasi Produk AI v2',
      description: 'Pengembangan sistem rekomendasi personalisasi berbasis user behavior menggunakan model hybrid.',
      deadline: '2026-07-20',
      pic: 'Wildan',
      currentStageIndex: 1,
      createdAt: new Date(Date.now() - 3600000 * 24 * 5)
    }
  });

  const proj2 = await prisma.project.create({
    data: {
      id: 'proj-2',
      name: 'PM Super Tools Workspace',
      description: 'Platform personal note-taking dan project tracker ringkas untuk meningkatkan produktivitas PM.',
      deadline: '2026-07-05',
      pic: 'Wildan',
      currentStageIndex: 2,
      createdAt: new Date(Date.now() - 3600000 * 24 * 3)
    }
  });

  console.log('Seeding Project Stages...');
  await prisma.projectStage.createMany({
    data: [
      // Project 1 stages
      { id: 'stage-1-1', projectId: 'proj-1', name: 'Ideation', order: 0, completedAt: new Date(Date.now() - 3600000 * 24 * 4) },
      { id: 'stage-1-2', projectId: 'proj-1', name: 'POC', order: 1 },
      { id: 'stage-1-3', projectId: 'proj-1', name: 'Kick Off', order: 2 },
      { id: 'stage-1-4', projectId: 'proj-1', name: 'Implementation', order: 3 },
      { id: 'stage-1-5', projectId: 'proj-1', name: 'Live', order: 4 },

      // Project 2 stages
      { id: 'stage-2-1', projectId: 'proj-2', name: 'Ideation', order: 0, completedAt: new Date(Date.now() - 3600000 * 24 * 2) },
      { id: 'stage-2-2', projectId: 'proj-2', name: 'POC', order: 1, completedAt: new Date(Date.now() - 3600000 * 24 * 1) },
      { id: 'stage-2-3', projectId: 'proj-2', name: 'Kick Off', order: 2 },
      { id: 'stage-2-4', projectId: 'proj-2', name: 'Implementation', order: 3 },
      { id: 'stage-2-5', projectId: 'proj-2', name: 'Live', order: 4 }
    ]
  });

  console.log('Seeding Action Items...');
  await prisma.actionItem.createMany({
    data: [
      {
        id: 'action-1',
        title: 'Tentukan baseline model Llama-3-8B',
        description: 'Lakukan benchmarking awal untuk akurasi dan kecepatan inferensi.',
        deadline: '2026-06-22',
        pic: 'Rian',
        status: 'done',
        sourceNoteId: 'note-1',
        projectId: 'proj-1',
        createdAt: new Date(Date.now() - 3600000 * 24)
      },
      {
        id: 'action-2',
        title: 'Deploy mock API endpoint untuk pengetesan latensi',
        description: 'Deploy di Vercel/AWS Lambda untuk testing latensi dari client side.',
        deadline: '2026-06-25',
        pic: 'Adi',
        status: 'open',
        sourceNoteId: 'note-1',
        projectId: 'proj-1',
        createdAt: new Date(Date.now() - 3600000 * 24)
      },
      {
        id: 'action-3',
        title: 'Ganti tampilan pipeline model kanban jadi model tab step-by-step horizontal',
        description: 'Hapus drag and drop, gantikan dengan tab indicator yang lebih clean.',
        deadline: '2026-06-24',
        pic: 'Ferry',
        status: 'done',
        sourceNoteId: 'note-2',
        projectId: 'proj-2',
        createdAt: new Date(Date.now() - 3600000 * 12)
      },
      {
        id: 'action-4',
        title: 'Tambahkan kustomisasi stage per project',
        description: 'Buat setting di project detail untuk manage stages list.',
        deadline: '2026-06-26',
        pic: 'Wildan',
        status: 'in_progress',
        sourceNoteId: 'note-2',
        projectId: 'proj-2',
        createdAt: new Date(Date.now() - 3600000 * 12)
      }
    ]
  });

  console.log('Seeding Artifacts...');
  await prisma.artifact.createMany({
    data: [
      {
        id: 'art-1',
        projectId: 'proj-1',
        label: 'Google Drive - POC Dataset',
        url: 'https://drive.google.com/drive/folders/dummy-poc-dataset-url',
        description: 'Dataset evaluasi 100 sample data dummy transaksi user.'
      },
      {
        id: 'art-2',
        projectId: 'proj-2',
        label: 'Figma - UI Design Design System',
        url: 'https://figma.com/file/dummy-workspace-ui-design-url',
        description: 'Sistem desain untuk warna putih-kuning hangat.'
      }
    ]
  });

  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
