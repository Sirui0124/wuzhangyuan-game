import { gunzipSync } from 'node:zlib';

const integer = value => { const b = Buffer.alloc(4); b.writeUInt32BE(value); return b; };
const field = bytes => Buffer.concat([integer(bytes.length), bytes]);
export function encodeEvent(event, payload = {}, session = '') {
  return Buffer.concat([Buffer.from([0x11, 0x14, 0x10, 0]), integer(event),
    ...(session ? [field(Buffer.from(session))] : []), field(Buffer.from(JSON.stringify(payload)))]);
}
export function decodeEvent(bytes) {
  const b = Buffer.from(bytes);
  if (b.length < 8 || b[0] >> 4 !== 1) throw new Error('Invalid TTS frame');
  const type = b[1] >> 4, flags = b[1] & 15;
  let offset = (b[0] & 15) * 4;
  const uint = () => { const n = b.readUInt32BE(offset); offset += 4; return n; };
  const field = () => { const n = uint(); if (n > b.length - offset) throw new Error('Truncated TTS frame'); const v = b.subarray(offset, offset + n); offset += n; return v; };
  if (type === 15) throw new Error(`TTS provider error ${uint()}`);
  if (flags & 1) uint();
  const event = flags & 4 ? uint() : 0;
  // Connection responses carry connect_id; session/data responses carry session_id.
  const id = event ? field().toString() : '';
  let payload = field();
  if ((b[2] & 15) === 1) payload = gunzipSync(payload, { maxOutputLength: 10 * 1024 * 1024 });
  else if ((b[2] & 15) !== 0) throw new Error('Unsupported TTS compression');
  return { type, event, id, payload };
}
