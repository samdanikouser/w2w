import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

async function main() {
  const token = jwt.sign({ id: '123' }, 'w2w-local-dev-secret-please-change-9f3a7c21b84e', { expiresIn: '1h' });
  
  const payload = {
    name: "Test Site",
    type: "GARDEN_SITE",
    status: "ACTIVE",
    currentSkipBinCount: 0,
    gateFee: 0,
    weighbridge: "active",
    depotId: ""
  };
  
  const res = await fetch('http://localhost:4000/api/sites', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  
  const data = await res.text();
  console.log("STATUS:", res.status);
  console.log("RESPONSE:", data);
}
main();
