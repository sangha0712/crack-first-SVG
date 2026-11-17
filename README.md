# DM image Worker

`/dm.png` renders the existing 390-unit layout at **3x (1170 pixels wide)**.
The SVG route and message parameters retain their existing behavior.

## Rendering and caching

- Successful PNGs are cached for 24 hours by all effective image parameters,
  including message text, side, time, name, status, date and avatar revision.
- A bounded 4 MiB / 16-entry in-memory cache also avoids repeated rendering in
  a warm isolate. Simultaneous identical requests share one render.
- Render failures and images with failed avatar downloads are not cached.
- `X-Render-Cache` reports `MISS`, `HIT` or `COALESCED`.
- Bump `CACHE_VERSION` in `render-cache.js` when changing layout or bundled
  assets. Bump `AVATAR_REV` in `worker.js` when updating remote avatars.
- Cache misses still require rendering and can exceed the Free plan's CPU
  limit. Caching reduces repeated work; it does not raise that limit.

## Assets

The bundled PNG avatar is resized to 128 pixels, above its largest 111-pixel
display size at 3x. UI fonts preserve every originally supported non-Han
character, including the full original Korean coverage. Requests containing
Han characters use the unchanged original complete fonts.

Rebuild the generated assets from the originals:

```sh
python -m pip install -r scripts/requirements-assets.txt
python scripts/optimize-assets.py
```

The original font license is retained in `OFL-NotoSansKR.txt`.

## Verification

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm check
```

Tests cover cache isolation, expiry/eviction, concurrency, failure recovery,
real Korean/Han PNG rendering, the 1170-pixel width, and SVG compatibility.
