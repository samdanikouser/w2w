const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3001,
  path: '/api/vehicles',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + process.argv[2]
  }
}, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => console.log('Vehicles:', res.statusCode, data));
});
req.write(JSON.stringify({
  registration: "TEST-123",
  status: "OPERATIONAL"
}));
req.end();
