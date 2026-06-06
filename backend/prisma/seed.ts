/**
 * Production-safe bootstrap seed.
 *
 * Seed script is no longer responsible for creating the first user.
 * The first user will be created securely from the frontend's Register Organization page
 * if the database has zero users.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('✔ Initializing base system roles (if needed)...');

  await prisma.customRole.upsert({
    where: { name: 'Super Admin' },
    update: {},
    create: {
      name: 'Super Admin',
      description: 'System Administrator with full access',
      modules: ['dashboard','facilities','epr-reports','pl-register','reports','demographics','employees','onboarding','attendance','check-in-out','beneficiary','stock-register','stock-variance','vehicles','depots','depot-scanner','training','violations','audit-log','waste-logs','w2w-settings'],
    },
  });

  console.log('✔ Database seed complete. No users created (handled by UI registration).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
