// Bump this whenever the layout, fonts, or bundled avatar changes.
const CACHE_VERSION = "png-2";
const EDGE_TTL_SECONDS = 86400;
const MEMORY_TTL_MS = 10 * 60 * 1000;
const MAX_MEMORY_BYTES = 4 * 1024 * 1024;
const MAX_MEMORY_ENTRIES = 16;
const memory = new Map();
const inFlight = new Map();
let memoryBytes = 0;

export async function cachedPng(request, parameters, render, ctx) {
  // Hash the effective parameters, including all messages and avatar revision.
  // Different dialogue must never receive another dialogue's cached picture.
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(parameters)));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const key = new Request(new URL(`/__png-cache/${CACHE_VERSION}/${hash}.png`, request.url));
  const saved = memory.get(key.url);
  if (saved) {
    if (saved.expires > Date.now()) {
      memory.delete(key.url);
      memory.set(key.url, saved);
      return pngResponse(saved.bytes, "HIT", true);
    }
    forget(key.url);
  }

  const existing = inFlight.get(key.url);
  if (existing) {
    const result = await existing;
    return pngResponse(result.bytes, "COALESCED", result.cacheable);
  }

  const task = (async () => {
    let edge;
    try {
      edge = globalThis.caches?.default;
      const cached = await edge?.match(key);
      if (cached?.ok && cached.headers.get("Content-Type") === "image/png") {
        const bytes = new Uint8Array(await cached.arrayBuffer());
        remember(key.url, bytes);
        return { bytes, cacheable: true, hit: true };
      }
    } catch {
      // Cache availability must not affect successful image generation.
    }

    const result = await render();
    if (result.cacheable) {
      remember(key.url, result.bytes);
      if (edge) {
        const write = Promise.resolve().then(() => edge.put(key, pngResponse(result.bytes, "HIT", true))).catch(() => {});
        if (ctx?.waitUntil) ctx.waitUntil(write);
        else await write;
      }
    }
    return { ...result, hit: false };
  })();
  inFlight.set(key.url, task);
  try {
    const result = await task;
    return pngResponse(result.bytes, result.hit ? "HIT" : "MISS", result.cacheable);
  } finally {
    inFlight.delete(key.url);
  }
}

function pngResponse(bytes, status, cacheable) {
  return new Response(bytes, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": "inline",
      "Cache-Control": cacheable ? `public, max-age=${EDGE_TTL_SECONDS}` : "no-store, max-age=0",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
      "X-Render-Cache": status,
    },
  });
}

function forget(key) {
  const entry = memory.get(key);
  if (entry) memoryBytes -= entry.bytes.byteLength;
  memory.delete(key);
}

function remember(key, bytes) {
  forget(key);
  if (bytes.byteLength > MAX_MEMORY_BYTES) return;
  while (memory.size >= MAX_MEMORY_ENTRIES || memoryBytes + bytes.byteLength > MAX_MEMORY_BYTES) {
    forget(memory.keys().next().value);
  }
  memory.set(key, { bytes, expires: Date.now() + MEMORY_TTL_MS });
  memoryBytes += bytes.byteLength;
}
