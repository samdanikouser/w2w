/**
 * Production-safe bootstrap seed.
 *
 * Creates ONLY a single super-admin user from env vars so the platform has
 * something to log in with on first boot. Everything else (employees, sites,
 * waste types, vehicles, etc.) is created by users via the UI.
 *
 * Required env vars (refused if missing in production):
 *   - SEED_ADMIN_EMAIL
 *   - SEED_ADMIN_PASSWORD
 *   - SEED_ADMIN_NAME      (optional, defaults to "System Administrator")
 *
 * This script is idempotent: re-running it will NOT reset the password of an
 * existing admin and will NOT downgrade their role.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME || 'System Administrator';

  if (!email || !password) {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in production. Refusing to seed.');
      process.exit(1);
    }
    console.warn('⚠️  SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set. Using dev defaults — CHANGE BEFORE PRODUCTION.');
  }

  const adminEmail = email || 'admin@w2w.local';
  const adminPassword = password || 'ChangeMe!2026';

  if (adminPassword.length < 12) {
    console.error('❌ Admin password must be at least 12 characters.');
    process.exit(1);
  }

  // Idempotent: skip if admin user already exists
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log(`✔ Admin user already exists (${adminEmail}). No changes made.`);
    return;
  }

  const superAdminRole = await prisma.customRole.upsert({
    where: { name: 'Super Admin' },
    update: {},
    create: {
      name: 'Super Admin',
      description: 'System Administrator with full access',
      modules: ['dashboard','sites','epr-reports','pl-register','reports','demographics','employees','onboarding','attendance','check-in-out','beneficiary','stock-register','stock-variance','vehicles','depots','depot-scanner','training','violations','audit-log','waste-logs','w2w-settings'],
    },
  });

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      name,
      customRoleId: superAdminRole.id,
      isActive: true,
    },
  });

  // Seed welcome notifications for the admin
  await prisma.notifications.createMany({
    data: [
      { userId: admin.id, type: 'SUCCESS', icon: '🎉', title: 'Welcome to W2W Platform', message: 'Your account has been set up successfully.', action: 'dashboard' },
      { userId: admin.id, type: 'WARNING', icon: '🔐', title: 'Change your password', message: 'Please update your default password for security.', action: 'profile' },
      { userId: admin.id, type: 'INFO', icon: '⚙', title: 'Configure your programme', message: 'Set up waste categories, training modules, and payment scales.', action: 'w2w-settings' },
      { userId: admin.id, type: 'INFO', icon: '👥', title: 'Add your team', message: 'Create user accounts for your staff and assign roles.', action: 'w2w-settings' },
    ],
  });

  console.log(`✔ Bootstrap admin created: ${adminEmail}`);
  console.log('  CHANGE THE PASSWORD IMMEDIATELY after first login (Settings → Security).');
  console.log('  4 welcome notifications seeded.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
