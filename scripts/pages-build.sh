#!/bin/sh
# ============================================================
# Cloudflare Pages 向けビルド（CI/ローカル両対応）
#
# 手順:
#   1. vercel build がフレッシュ環境で「No Project Settings」にならないよう、
#      next-on-pages 同等の最小 .vercel/project.json を用意する。
#   2. vercel build で .vercel/output を生成。
#   3. patch-async-hooks.sh で出力内の require("async_hooks") を
#      AsyncLocalStorage 互換 stub に置換（Workers ランタイム対応）。
#   4. next-on-pages -s（ビルド済みをスキップしてバンドルのみ）で _worker.js を生成。
# ============================================================
set -eu

mkdir -p .vercel
if [ ! -f .vercel/project.json ]; then
  printf '{"projectId":"_","orgId":"_","settings":{}}' > .vercel/project.json
fi

vercel build
sh scripts/patch-async-hooks.sh
next-on-pages -s
