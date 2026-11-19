// Git blob SHA in the browser, the same value GitHub reports for a file:
// SHA-1 of "blob <byte length>\0" followed by the file's bytes.

/** `content` is a string (encoded as UTF-8) or an ArrayBuffer / Uint8Array. Returns 40 hex chars,
 *  or null if this browser has no Web Crypto (only on insecure http pages). */
export async function gitBlobSha(content) {
  const bytes = typeof content === 'string'
    ? new TextEncoder().encode(content)
    : new Uint8Array(content instanceof ArrayBuffer ? content : content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength));
  const header = new TextEncoder().encode(`blob ${bytes.length}\0`);
  const all = new Uint8Array(header.length + bytes.length);
  all.set(header, 0);
  all.set(bytes, header.length);
  try {
    const digest = await crypto.subtle.digest('SHA-1', all);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}
