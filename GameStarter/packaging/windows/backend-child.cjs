'use strict';
const { pathToFileURL } = require('node:url');
const { once } = require('node:events');

(async () => {
  const { gameServer } = await import(pathToFileURL(process.argv[2]).href);
  if (!gameServer.listening) await once(gameServer, 'listening');
  process.parentPort.postMessage({ type: 'ready', port: gameServer.address().port, pid: process.pid, node: process.versions.node });
  const close = () => {
    gameServer.close(() => process.exit(0));
    gameServer.closeAllConnections();
    setTimeout(() => process.exit(0), 1200).unref();
  };
  process.parentPort.on('message', event => { if (event.data?.type === 'shutdown') close(); });
  process.on('SIGTERM', close);
})().catch(error => {
  process.parentPort?.postMessage({ type: 'failed', message: error.message });
  process.exit(1);
});
