
const fs = require('fs');
let code = fs.readFileSync('backend/src/routes/auth.ts', 'utf8');

const loginReplacement = `
    const loginModules = user.customRole?.modules || [];
    const token = jwt.sign(
      { userId: user.id, modules: loginModules },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        siteId: user.siteId,
        siteName: user.site?.name || null,
        modules: loginModules,
        roleName: user.customRole?.name || null,
      },
    });
`;

const registerReplacement = `
const registerSchema = z.object({
  email: z.string().email(),
  password: passwordPolicy,
  name: z.string().min(1),
  orgName: z.string().optional(),
});

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name, orgName } = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    let siteId = null;
    if (orgName) {
      const site = await prisma.site.create({
        data: { name: orgName, type: 'COOPERATIVE', status: 'ACTIVE' },
      });
      siteId = site.id;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    
    // Create an Admin role for this newly registered user
    const ALL_MODULES = ['dashboard','sites','epr-reports','pl-register','reports','demographics','employees','onboarding','attendance','check-in-out','beneficiary','stock-register','stock-variance','vehicles','depots','depot-scanner','training','violations','audit-log','waste-logs','w2w-settings'];
    
    const adminRole = await prisma.customRole.create({
      data: {
        name: 'System Administrator - ' + (orgName || name),
        description: 'Auto-generated admin role from registration',
        modules: ALL_MODULES,
        isActive: true
      }
    });

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
        siteId,
        customRoleId: adminRole.id,
        isActive: true,
      },
      include: { site: true, customRole: true },
    });

    await prisma.auditLog.create({
      data: { userId: user.id, action: 'REGISTER', entity: 'User', entityId: user.id, ipAddress: req.ip || null },
    });

    const regModules = adminRole.modules;

    const token = jwt.sign(
      { userId: user.id, modules: regModules },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        siteId: user.siteId,
        siteName: user.site?.name || null,
        modules: regModules,
        roleName: user.customRole?.name || null,
      },
    });
  } catch (err) {
    next(err);
  }
});
`;

const meReplacement = `
// ── GET /api/auth/me ──
router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { site: true, customRole: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const meModules = user.customRole?.modules || [];

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      siteId: user.siteId,
      siteName: user.site?.name || null,
      modules: meModules,
      roleName: user.customRole?.name || null,
    });
  } catch (err) {
    next(err);
  }
});
`;

// We will use regex to replace the sections
code = code.replace(/const token = jwt.sign\([\s\S]*?}\);/g, ''); // Remove the first login block end
code = code.replace(/const ALL_MODULES = [\s\S]*?res\.json\({[\s\S]*?}\);/g, loginReplacement);

code = code.replace(/const registerSchema = [\s\S]*?router\.post\('\/register'[\s\S]*?}\);/g, registerReplacement);

code = code.replace(/\/\/ ── GET \/api\/auth\/me ──[\s\S]*?}\);/g, meReplacement);

fs.writeFileSync('backend/src/routes/auth.ts', code);
