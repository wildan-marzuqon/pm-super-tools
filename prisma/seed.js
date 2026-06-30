const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seeding RBAC data...');

  // 1. Seed Capabilities
  const capabilities = [
    { id: 'view_dashboard', description: 'Melihat halaman dashboard utama' },
    { id: 'view_action_items', description: 'Melihat halaman action items' },
    { id: 'manage_action_items', description: 'Membuat, mengubah, dan menghapus action items' },
    { id: 'view_daily_plan', description: 'Melihat halaman daily plan' },
    { id: 'manage_daily_plan', description: 'Mengelola jadwal daily plan' },
    { id: 'view_projects', description: 'Melihat halaman proyek' },
    { id: 'manage_projects', description: 'Mengelola proyek (tambah, edit, hapus, kelola berkas/tahapan)' },
    { id: 'view_teams_load', description: 'Melihat halaman beban kerja tim' },
    { id: 'view_settings', description: 'Melihat halaman pengaturan' },
    { id: 'manage_settings', description: 'Mengubah pengaturan sistem' },
    { id: 'manage_rbac', description: 'Mengelola pengguna, peran, dan kapabilitas (RBAC)' }
  ];

  for (const cap of capabilities) {
    await prisma.capability.upsert({
      where: { id: cap.id },
      update: { description: cap.description },
      create: cap
    });
  }
  console.log('Capabilities seeded.');

  // 2. Seed Roles
  const rolesData = [
    { name: 'Super Admin', description: 'Akses penuh ke seluruh sistem dan kontrol RBAC' },
    { name: 'PM', description: 'Mengelola semua data proyek dan tugas, tanpa akses RBAC' },
    { name: 'Developer', description: 'Mengelola tugas harian dan memperbarui progres tugas/proyek' },
    { name: 'Viewer', description: 'Akses baca-saja (read-only) untuk melihat progres' }
  ];

  const roles = {};
  for (const roleData of rolesData) {
    roles[roleData.name] = await prisma.role.upsert({
      where: { name: roleData.name },
      update: { description: roleData.description },
      create: roleData
    });
  }
  console.log('Roles seeded.');

  // 3. Map Capabilities to Roles
  const mapping = {
    'Super Admin': capabilities.map(c => c.id),
    'PM': capabilities.filter(c => c.id !== 'manage_rbac').map(c => c.id),
    'Developer': [
      'view_dashboard',
      'view_action_items',
      'manage_action_items',
      'view_daily_plan',
      'manage_daily_plan',
      'view_projects',
      'view_teams_load'
    ],
    'Viewer': [
      'view_dashboard',
      'view_action_items',
      'view_daily_plan',
      'view_projects',
      'view_teams_load'
    ]
  };

  // Clear existing role capabilities mapping to prevent conflicts
  await prisma.roleCapability.deleteMany({});

  for (const [roleName, caps] of Object.entries(mapping)) {
    const role = roles[roleName];
    for (const capId of caps) {
      await prisma.roleCapability.create({
        data: {
          roleId: role.id,
          capabilityId: capId
        }
      });
    }
  }
  console.log('Role capabilities mapped.');

  // 4. Fetch unique PIC names from ActionItem & Project tables to seed users
  const actionItems = await prisma.actionItem.findMany({ select: { pic: true } });
  const projects = await prisma.project.findMany({ select: { pic: true } });

  const rawPics = new Set();
  actionItems.forEach(ai => { if (ai.pic) rawPics.add(ai.pic.trim()); });
  projects.forEach(p => { if (p.pic) rawPics.add(p.pic.trim()); });

  // Add default Super Admin name
  rawPics.add('Mokhamad Wildan Marzuqon');

  const uniquePics = Array.from(rawPics).filter(name => name.toLowerCase() !== 'unassigned' && name.length > 0);
  console.log(`Found unique PICs in database: ${JSON.stringify(uniquePics)}`);

  const defaultPasswordHash = await bcrypt.hash('Admin123!', 10);

  // Clear user roles association to prevent conflicts on re-run
  await prisma.userRole.deleteMany({});

  for (const picName of uniquePics) {
    // Generate clean email
    const cleanEmailName = picName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const email = `${cleanEmailName}@pmtools.com`;

    // Check if user already exists
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: picName,
          email,
          password: defaultPasswordHash
        }
      });
      console.log(`Created user: ${picName} (${email})`);
    } else {
      console.log(`User already exists: ${picName} (${email})`);
    }

    // Determine Role
    const isSuperAdmin = picName.toLowerCase().includes('wildan');
    const roleName = isSuperAdmin ? 'Super Admin' : 'Developer';
    const role = roles[roleName];

    const hasRole = await prisma.userRole.findFirst({
      where: { userId: user.id, roleId: role.id }
    });
    if (!hasRole) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id
        }
      });
      console.log(`Assigned role ${roleName} to ${picName}`);
    } else {
      console.log(`Role ${roleName} is already assigned to ${picName}`);
    }
  }

  // Also ensure default Admin user exists
  const adminEmail = 'admin@pmtools.com';
  let defaultAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!defaultAdmin) {
    defaultAdmin = await prisma.user.create({
      data: {
        name: 'Administrator',
        email: adminEmail,
        password: defaultPasswordHash
      }
    });
    console.log(`Created default admin user: ${adminEmail}`);
  }
  const hasAdminRole = await prisma.userRole.findFirst({
    where: { userId: defaultAdmin.id, roleId: roles['Super Admin'].id }
  });
  if (!hasAdminRole) {
    await prisma.userRole.create({
      data: {
        userId: defaultAdmin.id,
        roleId: roles['Super Admin'].id
      }
    });
    console.log('Assigned Super Admin role to default admin.');
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
