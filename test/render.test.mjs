import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.js";

async function png(params = {}) {
  const url = new URL("https://example.test/dm.png");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await worker.fetch(new Request(url));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "image/png");
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.deepEqual(Array.from(bytes.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(header.getUint32(16), 1170, "3x physical width must be preserved");
  return { bytes, response, height: header.getUint32(20) };
}

test("Korean text renders at 3x and repeated requests return the identical PNG", async () => {
  const params = { m1: "괜찮아? 퀭한 얼굴로 뭘 꿰뚫어 봐…", m2: "한글 ABC 123 !? ♡" };
  const first = await png(params);
  const second = await png(params);
  assert.equal(first.response.headers.get("X-Render-Cache"), "MISS");
  assert.equal(second.response.headers.get("X-Render-Cache"), "HIT");
  assert.deepEqual(first.bytes, second.bytes);
});

test("Han characters still render through the original complete fonts", async () => {
  await png({ name: "하린", m1: "漢字 龍 中文 日本語 한글" });
});

test("maximum-length five-message images remain 3x", async () => {
  const params = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`m${i + 1}`, "가나다라마바사아자차카타파하".repeat(13)]));
  const result = await png(params);
  assert.ok(result.height > 1000 && result.height < 4000);
});

test("non-GET requests retain the existing 405 response", async () => {
  assert.equal((await worker.fetch(new Request("https://example.test/dm.png", { method: "POST" }))).status, 405);
});

test("SVG still returns vector output and uses the original no-store policy", async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 404 });
  t.after(() => { globalThis.fetch = originalFetch; });
  const response = await worker.fetch(new Request("https://example.test/dm.svg?m1=SVG_test"));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Content-Type"), /^image\/svg\+xml/);
  assert.match(response.headers.get("Cache-Control"), /no-store/);
  assert.match(await response.text(), /SVG test/);
});
