const jwt = require('jsonwebtoken');
const http = require('http');

// Get a real user ID from the database
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst();
  const token = jwt.sign({ id: user.id }, 'w2w-local-dev-secret-please-change-9f3a7c21b84e', { expiresIn: '1h' });
  
  // Need to get a valid depotId too
  const depot = await prisma.depot.findFirst();
  const depotId = depot ? depot.id : null;

  const payload = JSON.stringify({
    name: "Test Site " + Date.now(),
    type: "GARDEN_SITE",
    status: "ACTIVE",
    currentSkipBinCount: 5,
    gateFee: 0,
    weighbridge: "active",
    depotId: depotId
  });

  const options = {
    hostname: 'localhost',
    port: 4000,
    path: '/api/sites',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log(`STATUS: ${res.statusCode}`);
      console.log(`BODY: ${data}`);
      prisma.$disconnect();
    });
  });

  req.on('error', e => {
    console.error(`problem with request: ${e.message}`);
    prisma.$disconnect();
  });

  req.write(payload);
  req.end();
}

main();
