const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const items = await prisma.actionItem.findMany({
    orderBy: { createdAt: 'desc' }
  });
  console.log('Action Items count:', items.length);
  console.log('Last 3 Action Items:', items.slice(0, 3));
  
  const drafts = await prisma.wACopilotDraft.findMany();
  console.log('Drafts count:', drafts.length);
  
  const projects = await prisma.project.findMany();
  console.log('Projects:', projects.map(p => ({ id: p.id, name: p.name })));
}

test().catch(console.error);
