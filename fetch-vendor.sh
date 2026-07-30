#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# 镜读 LensRead — rebuild the vendor/ folder from npm.
# Run once on a good connection (Git Bash on Windows is fine), then commit
# vendor/ to the repo. After that the app never touches an outside server.
#
#   bash fetch-vendor.sh
#
# Needs: node + npm, tar. Nothing is installed globally; npm pack just
# downloads the .tgz packages into a temp folder.
# ---------------------------------------------------------------------------
set -e

TJS=5.1.1          # tesseract.js       — the library and its worker
CORE=5.1.0         # tesseract.js-core  — the WebAssembly OCR engine
LANGS="eng chi_sim chi_tra"

TMP=$(mktemp -d)
OUT="$(pwd)/vendor"
mkdir -p "$OUT"
cd "$TMP"

echo "→ downloading tesseract.js@$TJS"
npm pack "tesseract.js@$TJS" --silent >/dev/null
tar xzf "tesseract.js-$TJS.tgz"
cp package/dist/tesseract.min.js package/dist/worker.min.js "$OUT/"
rm -rf package

echo "→ downloading tesseract.js-core@$CORE"
npm pack "tesseract.js-core@$CORE" --silent >/dev/null
tar xzf "tesseract.js-core-$CORE.tgz"
# LSTM-only cores. The app calls createWorker(langs, 1) = OEM 1 = LSTM only,
# so the legacy engine cores are not needed and would double the size.
# Both SIMD and plain are kept: the app picks at runtime by feature test.
cp package/tesseract-core-simd-lstm.wasm.js package/tesseract-core-lstm.wasm.js "$OUT/"
rm -rf package

for L in $LANGS; do
  echo "→ downloading traineddata: $L"
  npm pack "@tesseract.js-data/$L" --silent >/dev/null
  tar xzf tesseract.js-data-$L-*.tgz
  # 4.0.0_best_int = integer LSTM models. Small AND accurate.
  # The plain 4.0.0 folder is the combined legacy+LSTM set: chi_sim there is
  # 19 MB instead of 1.6 MB, and OEM 1 cannot use the legacy half anyway.
  cp "package/4.0.0_best_int/$L.traineddata.gz" "$OUT/"
  rm -rf package
done

cd - >/dev/null
rm -rf "$TMP"

echo
echo "vendor/ contents:"
ls -l "$OUT" | awk 'NR>1 {printf "  %-40s %8.2f MB\n", $9, $5/1048576}'
echo
du -sh "$OUT"
echo "Done. Commit vendor/ and push."
