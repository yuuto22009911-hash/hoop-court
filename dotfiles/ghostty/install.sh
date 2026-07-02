#!/usr/bin/env bash
# Ghostty の config をユーザ設定パスへシンボリックリンクする。
# 既存 config があればタイムスタンプ付きで退避してから貼り替える。
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/config"
DEST_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/ghostty"
DEST="$DEST_DIR/config"

mkdir -p "$DEST_DIR"

if [ -e "$DEST" ] && [ ! -L "$DEST" ]; then
  backup="$DEST.backup.$(date +%Y%m%d%H%M%S)"
  mv "$DEST" "$backup"
  echo "既存 config を退避しました: $backup"
fi

ln -sf "$SRC" "$DEST"
echo "リンクしました: $DEST -> $SRC"
echo "Ghostty 上で ⌘ + Shift + , を押すと設定が反映されます。"
