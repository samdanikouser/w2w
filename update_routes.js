const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'backend/src/routes');

const mapModule = (filename) => {
  if (filename.includes('attendance')) return "'attendance'";
  if (filename.includes('auditLogs')) return "'audit-log'";
  if (filename.includes('deletionRequests')) return "'w2w-settings'";
  if (filename.includes('employees')) return "'employees'";
  if (filename.includes('eprReports')) return "'epr-reports'";
  if (filename.includes('notifications')) return "'dashboard'";
  if (filename.includes('roles')) return "'w2w-settings'";
  if (filename.includes('stockItems')) return "'stock-register'";
  if (filename.includes('training')) return "'training'";
  if (filename.includes('transactions')) return "'pl-register'";
  if (filename.includes('users')) return "'w2w-settings'";
  if (filename.includes('vehicles')) return "'vehicles'";
  if (filename.includes('violations')) return "'violations'";
  if (filename.includes('wasteLogs')) return "'waste-logs'";
  if (filename.includes('wasteTypes')) return "'w2w-settings'";
  return "'dashboard'";
};

const processFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  const filename = path.basename(filePath);
  
  if (content.includes('authorize(')) {
    const mod = mapModule(filename);
    
    // Replace authorize imports
    content = content.replace(/authorize/g, 'requireModule');
    
    // Replace requireModule(...) with requireModule('moduleName')
    content = content.replace(/requireModule\((['"A-Z_,\s]+)\)/g, `requireModule(${mod})`);
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filename}`);
  }
};

const files = fs.readdirSync(routesDir);
for (const file of files) {
  if (file.endsWith('.ts')) {
    processFile(path.join(routesDir, file));
  }
}
