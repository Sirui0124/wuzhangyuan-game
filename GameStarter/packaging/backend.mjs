// Share the existing AI protocol without altering its prompts or judgement rules.
import net from 'node:net';
const listen = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
  this.once('listening', () => { if (process.send) process.send({ port: this.address().port }); });
  return listen.apply(this, args);
};
process.env.PORT = '0';
await import('./server.mjs');
