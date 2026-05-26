const net = require('node:net');
const { spawn } = require('node:child_process');

const preferredPort = Number(process.env.PORT || 8081);
const maxAttempts = 20;

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port, '0.0.0.0');
  });
}

async function findPort(startPort) {
  for (let port = startPort; port < startPort + maxAttempts; port += 1) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(`No free port found in range ${startPort}-${startPort + maxAttempts - 1}`);
}

async function main() {
  const port = await findPort(preferredPort);
  const httpServerBin = require.resolve('http-server/bin/http-server');
  console.log(`Serving dist on http://localhost:${port}`);

  const child = spawn(process.execPath, [httpServerBin, 'dist', '-p', String(port), '-c-1'], {
    stdio: 'inherit',
    shell: false,
  });

  const shutdown = () => {
    if (!child.killed) {
      child.kill('SIGINT');
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  child.on('exit', (code, signal) => {
    if (signal) {
      process.exit(0);
    }

    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});