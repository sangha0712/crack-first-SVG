// Load Wrangler Data/CompiledWasm imports in Node for real rendering checks.
export async function load(url, context, nextLoad) {
  if (/\.(ttf|png|wasm)$/.test(url)) {
    return { format: "module", shortCircuit: true, source:
      `import {readFileSync} from 'node:fs';
       const bytes = readFileSync(new URL(${JSON.stringify(url)}));
       export default bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);` };
  }
  return nextLoad(url, context);
}
