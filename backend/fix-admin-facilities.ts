import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const role = await prisma.customRole.findFirst({ where: { name: 'Super Admin' }});
  if (role) {
    const modules = role.modules.map(m => m === 'sites' ? 'facilities' : m);
    if (!modules.includes('facilities')) modules.push('facilities');
    await prisma.customRole.update({
      where: { id: role.id },
      data: { modules }
    });
    console.log('Admin role updated with facilities module');
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
