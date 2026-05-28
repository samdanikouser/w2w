const fs = require('fs');
const path = require('path');

// Fix deletionRequests.ts
const drFile = 'backend/src/routes/deletionRequests.ts';
let drContent = fs.readFileSync(drFile, 'utf8');
drContent = drContent.replace(/user\.role === 'SUPER_ADMIN' \|\| user\.role === 'SITE_ADMIN'/g, 'req.userModules?.includes("w2w-settings")');
fs.writeFileSync(drFile, drContent);

// Fix roles.ts
const rolesFile = 'backend/src/routes/roles.ts';
let rolesContent = fs.readFileSync(rolesFile, 'utf8');
rolesContent = rolesContent.replace(/systemRole: z\.enum\(\['SUPER_ADMIN', 'SITE_ADMIN', 'DATA_CLERK', 'FIELD_WORKER'\]\),/g, '');
rolesContent = rolesContent.replace(/systemRole: d\.systemRole as any /g, '');
rolesContent = rolesContent.replace(/, systemRole: d\.systemRole as any/g, '');
fs.writeFileSync(rolesFile, rolesContent);

// Fix sites.ts
const sitesFile = 'backend/src/routes/sites.ts';
let sitesContent = fs.readFileSync(sitesFile, 'utf8');
sitesContent = sitesContent.replace(/authorize/g, 'requireModule');
sitesContent = sitesContent.replace(/requireModule\((['"A-Z_,\s]+)\)/g, `requireModule('dashboard')`); // default or settings
fs.writeFileSync(sitesFile, sitesContent);

// Fix users.ts
const usersFile = 'backend/src/routes/users.ts';
let usersContent = fs.readFileSync(usersFile, 'utf8');
// remove systemRole from select
usersContent = usersContent.replace(/systemRole: true, /g, '');
// remove systemRole logic
usersContent = usersContent.replace(/let systemRole:[^;]+;/g, '');
usersContent = usersContent.replace(/if \(cr\) systemRole = cr\.systemRole as any;/g, '');
usersContent = usersContent.replace(/role: systemRole,/g, '');
usersContent = usersContent.replace(/if \(systemRole\) data\.role = systemRole;/g, '');
usersContent = usersContent.replace(/role: true,/g, '');
fs.writeFileSync(usersFile, usersContent);
