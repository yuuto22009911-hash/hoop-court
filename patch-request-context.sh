#!/bin/sh
# ============================================================
# Cloudflare Pages (Workers Runtime) では Node.js の async_hooks が
# 使えないため、関連するコードを安全な stub に置き換える。
# ============================================================

# 1. @next/request-context 本体は完全 stub
mkdir -p node_modules/@next/request-context
cat > node_modules/@next/request-context/index.js << 'SHIM'
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContext = function() { return {}; };
exports.setContext = function() {};
exports.default = { getContext: exports.getContext, setContext: exports.setContext };
SHIM
echo "Patched @next/request-context"

# 2. @vercel/next/dist/middleware-launcher.js に vendor された
#    require("async_hooks") を、Workers ランタイムが提供する
#    AsyncLocalStorage を使う形に書き換える。
TARGET="node_modules/@vercel/next/dist/middleware-launcher.js"
if [ -f "$TARGET" ]; then
  # require("async_hooks") を AsyncLocalStorage 互換のオブジェクト stub に置換
  # Workers ランタイムでは globalThis.AsyncLocalStorage が利用可能
  /usr/bin/sed -i.bak \
    -e 's|require("async_hooks")|({AsyncLocalStorage: globalThis.AsyncLocalStorage \|\| class { getStore() { return undefined; } run(_s, fn) { return fn(); } }})|g' \
    "$TARGET"
  rm -f "${TARGET}.bak"
  echo "Patched @vercel/next/dist/middleware-launcher.js"
else
  echo "Skipped @vercel/next patch (file not found)"
fi
