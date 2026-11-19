// Watermark marker (TASK-15): a small hidden label that says "this file was made by the uploader".
// Text (ASCII JSON): {"wm":"puzzkezz-lattice","v":1,"f":<f>,"div":<divisor>}
// - WebP: an extra RIFF chunk "PZWM" at the end of an extended WebP (with a VP8X header), RIFF size updated.
// - PNG: a tEXt chunk with the keyword "puzzkezz-wm", before the first IDAT, with a correct CRC.
// Pure module: no DOM, so the admin page (browser) and the repo guard test (Node) both import it.
// The marker catches mistakes (an original committed by hand, a wrong file). It is not a lock: anyone who
// knows this format could copy it onto another file.

export const WM_ID = 'puzzkezz-lattice';
export const WM_VERSION = 1;
export const WEBP_CHUNK = 'PZWM';
export const PNG_KEYWORD = 'puzzkezz-wm';

/** A real marker is about 60 bytes; anything much bigger is not one (and is never decoded as text). */
const MAX_MARKER_BYTES = 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/* ---------- Bytes ---------- */

function toBytes(bytes) {
  if (bytes instanceof Uint8Array) return bytes;
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes);
  if (ArrayBuffer.isView(bytes)) return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  throw new TypeError('Expected a Uint8Array or ArrayBuffer');
}

const ascii = (b, start, end) => String.fromCharCode(...b.subarray(start, end));
const asciiBytes = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
const u32le = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
const u32be = (b, i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;

function putU32le(b, i, v) {
  b[i] = v & 0xff; b[i + 1] = (v >>> 8) & 0xff; b[i + 2] = (v >>> 16) & 0xff; b[i + 3] = (v >>> 24) & 0xff;
}
function putU32be(b, i, v) {
  b[i] = (v >>> 24) & 0xff; b[i + 1] = (v >>> 16) & 0xff; b[i + 2] = (v >>> 8) & 0xff; b[i + 3] = v & 0xff;
}
function putU24le(b, i, v) {
  b[i] = v & 0xff; b[i + 1] = (v >>> 8) & 0xff; b[i + 2] = (v >>> 16) & 0xff;
}

function concat(parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

let crcTable = null;
function crc32(b) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i += 1) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* ---------- Marker text ---------- */

function markerText(info) {
  const f = info && info.f;
  const div = info && info.div;
  if (!Number.isInteger(f) || f <= 0 || !Number.isInteger(div) || div <= 0) {
    throw new TypeError('addWatermarkMarker needs info = { f, div } with positive whole numbers');
  }
  return JSON.stringify({ wm: WM_ID, v: WM_VERSION, f, div });
}

/** The marker object from its text, or null if it is not a valid marker. */
function parseMarker(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || data.wm !== WM_ID || data.v !== WM_VERSION) return null;
  if (!Number.isInteger(data.f) || data.f <= 0 || !Number.isInteger(data.div) || data.div <= 0) return null;
  return { wm: data.wm, v: data.v, f: data.f, div: data.div };
}

/* ---------- WebP ---------- */

const isWebp = (b) => b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP';

/** The chunks of a WebP file, or null if the RIFF structure is broken or cut off. */
function webpChunks(b) {
  const end = u32le(b, 4) + 8;
  if (end < 12 || end > b.length) return null;
  const chunks = [];
  let at = 12;
  while (at < end) {
    if (at + 8 > end) return null;
    const size = u32le(b, at + 4);
    const dataEnd = at + 8 + size;
    const next = dataEnd + (size & 1);
    if (dataEnd > end || next > end) return null;
    chunks.push({ fourcc: ascii(b, at, at + 4), start: at, data: at + 8, size, next });
    at = next;
  }
  return chunks.length ? chunks : null;
}

function riffChunk(fourcc, data) {
  const out = new Uint8Array(8 + data.length + (data.length & 1));
  out.set(asciiBytes(fourcc), 0);
  putU32le(out, 4, data.length);
  out.set(data, 8);
  return out;
}

/** A VP8X chunk for a simple (VP8 / VP8L) WebP, so the file may carry an extra chunk. */
function vp8xFor(b, chunk) {
  let width;
  let height;
  let alpha = false;
  const d = chunk.data;
  if (chunk.fourcc === 'VP8 ') {
    if (chunk.size < 10 || b[d + 3] !== 0x9d || b[d + 4] !== 0x01 || b[d + 5] !== 0x2a) throw new Error('Bad VP8 data');
    width = (b[d + 6] | (b[d + 7] << 8)) & 0x3fff;
    height = (b[d + 8] | (b[d + 9] << 8)) & 0x3fff;
  } else if (chunk.fourcc === 'VP8L') {
    if (chunk.size < 5 || b[d] !== 0x2f) throw new Error('Bad VP8L data');
    const bits = u32le(b, d + 1);
    width = (bits & 0x3fff) + 1;
    height = ((bits >>> 14) & 0x3fff) + 1;
    alpha = Boolean((bits >>> 28) & 1);
  } else {
    throw new Error('Unknown WebP image data');
  }
  if (!width || !height) throw new Error('Bad WebP size');
  const data = new Uint8Array(10);
  data[0] = alpha ? 0x10 : 0;
  putU24le(data, 4, width - 1);
  putU24le(data, 7, height - 1);
  return riffChunk('VP8X', data);
}

function addToWebp(b, text) {
  const chunks = webpChunks(b);
  if (!chunks) throw new Error('Broken WebP file');
  const keep = chunks.filter((c) => c.fourcc !== WEBP_CHUNK);
  const parts = [];
  if (keep[0].fourcc !== 'VP8X') parts.push(vp8xFor(b, keep[0]));
  for (const c of keep) {
    const raw = b.subarray(c.start, c.next);
    // A last chunk without its pad byte would break the chunk after it: copy it padded.
    parts.push(raw.length === 8 + c.size + (c.size & 1) ? raw : riffChunk(c.fourcc, b.subarray(c.data, c.data + c.size)));
  }
  parts.push(riffChunk(WEBP_CHUNK, asciiBytes(text)));
  const body = concat(parts);
  const out = new Uint8Array(12 + body.length);
  out.set(asciiBytes('RIFF'), 0);
  putU32le(out, 4, 4 + body.length);
  out.set(asciiBytes('WEBP'), 8);
  out.set(body, 12);
  return out;
}

function readFromWebp(b) {
  const chunks = webpChunks(b);
  if (!chunks || chunks[0].fourcc !== 'VP8X') return null;
  const mark = chunks.find((c) => c.fourcc === WEBP_CHUNK);
  return mark && mark.size <= MAX_MARKER_BYTES ? parseMarker(ascii(b, mark.data, mark.data + mark.size)) : null;
}

/* ---------- PNG ---------- */

const isPng = (b) => b.length >= 8 && PNG_SIGNATURE.every((v, i) => b[i] === v);

/** The chunks of a PNG file up to and including IEND, or null if it is broken or cut off. */
function pngChunks(b) {
  const chunks = [];
  let at = 8;
  for (;;) {
    if (at + 12 > b.length) return null;
    const size = u32be(b, at);
    const next = at + 12 + size;
    if (next > b.length) return null;
    const type = ascii(b, at + 4, at + 8);
    chunks.push({ type, start: at, data: at + 8, size, next });
    at = next;
    if (type === 'IEND') break;
  }
  if (chunks[0].type !== 'IHDR' || !chunks.some((c) => c.type === 'IDAT')) return null;
  return chunks;
}

const crcOk = (b, c) => crc32(b.subarray(c.start + 4, c.data + c.size)) === u32be(b, c.data + c.size);

/** The text of a tEXt chunk with our keyword, or null. */
function markerTextOf(b, c) {
  if (c.type !== 'tEXt' || c.size > MAX_MARKER_BYTES) return null;
  const data = b.subarray(c.data, c.data + c.size);
  const zero = data.indexOf(0);
  if (zero === -1 || ascii(data, 0, zero) !== PNG_KEYWORD) return null;
  return ascii(data, zero + 1, data.length);
}

function addToPng(b, text) {
  const chunks = pngChunks(b);
  if (!chunks) throw new Error('Broken PNG file');
  const data = asciiBytes(`${PNG_KEYWORD}\0${text}`);
  const chunk = new Uint8Array(12 + data.length);
  putU32be(chunk, 0, data.length);
  chunk.set(asciiBytes('tEXt'), 4);
  chunk.set(data, 8);
  putU32be(chunk, 8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
  const parts = [b.subarray(0, 8)];
  for (const c of chunks) {
    if (markerTextOf(b, c) !== null) continue; // an older marker is replaced
    if (c.type === 'IDAT' && !parts.includes(chunk)) parts.push(chunk);
    parts.push(b.subarray(c.start, c.next));
  }
  return concat(parts);
}

function readFromPng(b) {
  const chunks = pngChunks(b);
  if (!chunks) return null;
  for (const c of chunks) {
    if (c.type === 'IDAT') return null; // the marker sits before the first IDAT
    const text = markerTextOf(b, c);
    if (text !== null && crcOk(b, c)) return parseMarker(text);
  }
  return null;
}

/* ---------- API ---------- */

/**
 * Returns a copy of `bytes` (a WebP or PNG) with the marker added. `info` = { f, div }.
 * Only metadata changes: the image data is copied as it is. Throws for any other file type.
 */
export function addWatermarkMarker(bytes, info) {
  const b = toBytes(bytes);
  const text = markerText(info);
  if (isWebp(b)) return addToWebp(b, text);
  if (isPng(b)) return addToPng(b, text);
  throw new Error('Only WebP and PNG files can carry the watermark marker');
}

/** `{ wm: "puzzkezz-lattice", v: 1, f, div }` for a marked WebP or PNG, otherwise null. Never throws. */
export function readWatermarkMarker(bytes) {
  try {
    const b = toBytes(bytes);
    if (isWebp(b)) return readFromWebp(b);
    if (isPng(b)) return readFromPng(b);
    return null;
  } catch {
    return null;
  }
}
