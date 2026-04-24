#!/bin/sh
mkdir -p node_modules/@next/request-context
cat > node_modules/@next/request-context/index.js << 'SHIM'
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContext = function() { return {}; };
exports.setContext = function() {};
exports.default = { getContext: exports.getContext, setContext: exports.setContext };
SHIM
echo "Patched @next/request-context"
