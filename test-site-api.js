const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3001,
  path: '/api/sites',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + process.argv[2]
  }
}, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => console.log('Sites:', res.statusCode, data));
});
req.write(JSON.stringify({
  name: "TEST-DEPOT",
  type: "DEPOT",
  status: "ACTIVE"
}));
req.end();
