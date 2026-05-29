import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  try {
    const log = await prisma.auditLog.create({
      data: { userId: undefined, action: 'CREATE', entity: 'Site', entityId: '123', detail: 'test' }
    });
    console.log("SUCCESS:", log);
  } catch (err) {
    console.error("ERROR:", err.message);
  }
}
main().finally(() => prisma.$disconnect());
