const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const entries = await prisma.dailyPlanEntry.findMany({
    orderBy: { date: 'desc' }
  });
  console.log('Daily Plan Entries:', JSON.stringify(entries, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
