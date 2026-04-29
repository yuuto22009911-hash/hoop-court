#!/bin/sh
# ============================================================
# Cloudflare Pages (Workers Runtime) には Node.js の async_hooks が無い。
# vercel build が出力する .vercel/output/functions/*/index.js の中で
# `require("async_hooks")` がインライン化されているため、
# next-on-pages のバンドル前に AsyncLocalStorage 互換の stub に置換する。
#
# Workers ランタイムは globalThis.AsyncLocalStorage を提供するので、
# それが利用可能な環境ではそれを使い、そうでなければ no-op stub を返す。
# ============================================================
set -eu

if [ ! -d ".vercel/output/functions" ]; then
  echo "skip: .vercel/output/functions not found (run 'vercel build' first)"
  exit 0
fi

PATCHED=0
for f in $(find .vercel/output/functions -name "index.js" -type f); do
  if grep -q 'require("async_hooks")' "$f"; then
    /usr/bin/sed -i.bak \
      -e 's|require("async_hooks")|({AsyncLocalStorage: globalThis.AsyncLocalStorage \|\| class { getStore() { return undefined; } run(_s, fn) { return fn(); } }})|g' \
      "$f"
    rm -f "${f}.bak"
    PATCHED=$((PATCHED + 1))
  fi
done

echo "patched $PATCHED file(s)"
