const localtunnel = require('localtunnel');
const fs = require('fs');
const path = require('path');

const port = 3000;
const filePath = path.join(__dirname, 'tunnel-url.txt');

async function start() {
  console.log('Starting localtunnel on port', port);
  try {
    const tunnel = await localtunnel({ port });
    console.log('Tunnel started at:', tunnel.url);
    
    // Write URL to file
    fs.writeFileSync(filePath, tunnel.url, 'utf8');
    console.log('Saved URL to', filePath);

    tunnel.on('close', () => {
      console.log('Tunnel closed');
    });
  } catch (err) {
    console.error('Error starting tunnel:', err);
    fs.writeFileSync(filePath, 'Error: ' + err.message, 'utf8');
  }
}

start();
