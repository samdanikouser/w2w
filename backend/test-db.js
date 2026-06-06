import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const mods = await prisma.trainingModule.findMany();
  console.log(JSON.stringify(mods, null, 2));
}
run();
