# 镜读 LensRead — self-hosted OCR PWA

Live camera OCR (Chinese + English) that keeps its notes on the device and
exports them. **No CDN, no API key, no server.** Every byte the engine needs is
in `vendor/` in this repo.

---

## Deploy

```bash
git init
git add .
git commit -m "LensRead v2 — vendored OCR engine"
git remote add origin git@github.com:stanleywoosweeleong/<repo>.git
git push -u origin main
```

Then **Settings → Pages → Source: main / (root)**. Wait for the green tick and
open `https://stanleywoosweeleong.github.io/<repo>/` on the phone.

First visit, on WiFi: **设置 → 预载离线包**. It downloads ~8.4 MB and reports
「离线就绪」. From then on the app runs with the mobile data off.

Add to Home Screen on iOS so it opens without Safari chrome.

---

## Why it must be https

`getUserMedia` — the live lens — is only handed to a secure context. GitHub
Pages is https, so it works there. Opening `index.html` from `file://` still
works for photo mode, notes and export, but the live viewfinder is blocked by
the browser and the app falls back and tells you so.

---

## What is in `vendor/` and why

| File | Size | Role |
|---|---|---|
| `tesseract.min.js` | 0.07 MB | the library you call from the page |
| `worker.min.js` | 0.12 MB | runs in a Web Worker so OCR never freezes the UI |
| `tesseract-core-simd-lstm.wasm.js` | 3.9 MB | the OCR engine itself, WebAssembly, SIMD build |
| `tesseract-core-lstm.wasm.js` | 3.9 MB | same engine for devices without WASM SIMD |
| `chi_sim.traineddata.gz` | 1.7 MB | Simplified Chinese model |
| `chi_tra.traineddata.gz` | 1.6 MB | Traditional Chinese model |
| `eng.traineddata.gz` | 2.9 MB | English model |

Four decisions worth understanding, because they are where the size goes:

**1. LSTM only.** The app calls `createWorker(langs, 1, …)`. The `1` is OEM 1 =
LSTM only. Tesseract also ships a legacy pattern-matching engine; OEM 1 never
touches it, so the legacy halves of both the engine and the models are dead
weight. That is why only the `*-lstm` cores are vendored.

**2. `4.0.0_best_int` models, not `4.0.0`.** Counter-intuitive but the
`best_int` folder is the *smaller* one: `chi_sim` is 1.7 MB there versus 19 MB
in `4.0.0`. The big folder is the combined legacy + LSTM set. `best_int` is the
integer-quantised LSTM model — smaller and, at OEM 1, the accurate choice.
Picking wrong here costs 25 MB and buys nothing.

**3. `corePath` is a directory, not a file.** Given a directory, the worker
appends the core filename it needs after a WebAssembly SIMD feature test —
`/tesseract-core-simd-lstm.wasm.js` or `/tesseract-core-lstm.wasm.js`. That is
why both are shipped: the device chooses, and only downloads the one it uses.
Point `corePath` at a `.js` file instead and you override that choice.

**4. `langPath` + `gzip`.** The worker builds the model URL as
`<langPath>/<lang>.traineddata.gz`. The `.gz` suffix comes from the `gzip: true`
option, which is the default. If you ever host uncompressed `.traineddata`,
set `gzip: false` or the fetch 404s.

The `.wasm.js` files embed the WebAssembly as base64 inside the JavaScript —
there is no separate `.wasm` to serve, which is why the folder listing looks
short.

---

## How the offline path actually works

Two independent caches, which is why offline is reliable:

1. **`sw.js`** precaches the shell plus the SIMD core, `chi_sim` and `eng` on
   install — sequentially, not in parallel, because a farm connection drops a
   burst of 4 MB requests. Anything under `/vendor/` is served cache-first with
   no revalidation, since those files never change within a deploy.
2. **Tesseract's own IndexedDB cache** stores the traineddata after first use.

The 设置 → 离线包 panel checks the Cache API for each file the *current language
pack* needs and reports 就绪 / 未完成 / 未预载 with the missing count. It reads
the real cache — it does not trust a saved flag.

If `vendor/` is ever missing from the deploy, the app falls back to jsDelivr
**and raises a red banner saying so**, rather than quietly working on your desk
and failing in the orchard.

---

## Updating the engine

```bash
bash fetch-vendor.sh      # re-downloads vendor/ from npm
```

Edit `TJS`, `CORE`, `LANGS` at the top of the script to change versions or add
a language. Adding a language: put it in `LANGS`, re-run, then add an
`<option>` to `#packSel` in `index.html`.

**After any change to `index.html` or `sw.js`, bump `CACHE_VERSION` in `sw.js`**
(`lensread-<timestamp>`), or devices keep serving the old shell from cache.

```bash
node --check sw.js        # before every deploy
```

---

## Repo hygiene

- `.nojekyll` stops GitHub Pages running Jekyll over the folder.
- The repo is ~14 MB, well under the 1 GB Pages limit.
- Bandwidth: each new device pulls ~8.4 MB once. The 100 GB/month soft limit is
  roughly 12,000 first installs — no concern for a 3,000-person list.
- Public repo required on the free plan. Nothing secret lives here.

---

## Data

Notes are in `localStorage` under `lensread.notes.v1`, on that one device, in
that one browser. Nothing is uploaded. Clearing site data erases them — export
a JSON backup from 设置 before clearing anything, and tell testers the same.
