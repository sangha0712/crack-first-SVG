import test from "node:test";
import assert from "node:assert/strict";

let instance = 0;
const request = new Request("https://example.test/dm.png?m1=hello");
const parameters = { name: "하린", status: "활동 중", date: "오늘", avatarKey: "hr", avatarRev: "1",
  messages: [{ side: "them", text: "hello", time: "12:00" }] };
const bytes = new Uint8Array([137, 80, 78, 71]);

async function fresh(edge) {
  globalThis.caches = edge ? { default: edge } : undefined;
  return (await import(`../render-cache.js?test=${instance++}`)).cachedPng;
}

test("identical effective parameters reuse bytes after the first response is consumed", async () => {
  const cached = await fresh();
  let renders = 0;
  const render = async () => ({ bytes, cacheable: (++renders, true) });
  const first = await cached(request, parameters, render);
  assert.equal(first.headers.get("X-Render-Cache"), "MISS");
  assert.deepEqual(new Uint8Array(await first.arrayBuffer()), bytes);
  const second = await cached(new Request("https://example.test/dm.png?unused=1"), parameters, render);
  assert.equal(second.headers.get("X-Render-Cache"), "HIT");
  assert.deepEqual(new Uint8Array(await second.arrayBuffer()), bytes);
  assert.equal(renders, 1);
});

test("all visible parameters and avatar revision distinguish cached images", async () => {
  const cached = await fresh();
  let renders = 0;
  const render = async () => ({ bytes, cacheable: (++renders, true) });
  const variants = [parameters,
    ...["name", "status", "date", "avatarKey", "avatarRev"].map(key => ({ ...parameters, [key]: "different" })),
    ...["side", "text", "time"].map(key => ({ ...parameters,
      messages: [{ ...parameters.messages[0], [key]: "different" }] }))];
  for (const value of variants) await cached(request, value, render);
  assert.equal(renders, variants.length);
});

test("an edge hit survives a new isolate without invoking the renderer", async () => {
  const stored = new Map();
  const edge = { match: async key => stored.get(key.url)?.clone(),
    put: async (key, response) => { stored.set(key.url, response.clone()); } };
  const first = await fresh(edge);
  await first(request, parameters, async () => ({ bytes, cacheable: true }));
  const cold = await fresh(edge);
  const response = await cold(request, parameters, () => { throw new Error("must not render"); });
  assert.equal(response.headers.get("X-Render-Cache"), "HIT");
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
});

test("cache failures do not prevent image generation", async () => {
  for (const failure of ["match", "put"]) {
    const edge = { match: async () => undefined, put: async () => undefined };
    edge[failure] = async () => { throw new Error("cache unavailable"); };
    const cached = await fresh(edge);
    assert.equal((await cached(request, parameters, async () => ({ bytes, cacheable: true }))).status, 200);
  }
});

test("simultaneous identical requests render only once", async () => {
  const cached = await fresh();
  let renders = 0;
  const render = async () => {
    renders++;
    await new Promise(resolve => setTimeout(resolve, 10));
    return { bytes, cacheable: true };
  };
  const responses = await Promise.all(Array.from({ length: 8 }, () => cached(request, parameters, render)));
  assert.equal(renders, 1);
  for (const response of responses) assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
});

test("failed renders and missing avatars are retried rather than cached", async () => {
  const cached = await fresh();
  await assert.rejects(cached(request, parameters, async () => { throw new Error("render failed"); }));
  let renders = 0;
  const render = async () => ({ bytes, cacheable: (++renders, false) });
  for (let i = 0; i < 2; i++) {
    const response = await cached(request, parameters, render);
    assert.match(response.headers.get("Cache-Control"), /no-store/);
  }
  assert.equal(renders, 2);
});

test("memory cache respects entry count and expiry", async t => {
  const cached = await fresh();
  let renders = 0;
  const render = async () => ({ bytes, cacheable: (++renders, true) });
  for (let i = 0; i < 17; i++) await cached(request, { ...parameters, date: String(i) }, render);
  await cached(request, { ...parameters, date: "0" }, render);
  assert.equal(renders, 18);
  const now = Date.now;
  t.after(() => { Date.now = now; });
  Date.now = () => now() + 11 * 60 * 1000;
  await cached(request, { ...parameters, date: "0" }, render);
  assert.equal(renders, 19);
});

test("memory cache evicts by byte size, not only entry count", async () => {
  const cached = await fresh();
  let renders = 0;
  const render = async () => ({ bytes: new Uint8Array(3 * 1024 * 1024), cacheable: (++renders, true) });
  await cached(request, { id: 1 }, render);
  await cached(request, { id: 2 }, render);
  await cached(request, { id: 1 }, render);
  assert.equal(renders, 3);
});
