# Ghostty 設定（自分仕様）

[Ghostty](https://ghostty.org) ターミナルの個人設定。
fendo181 さんの記事 [「Ghosttyへ入門する」](https://zenn.dev/fendo181/articles/2b75b12c80fe06)
の「最終的な自分のconfig（2026年1月時点）」をベースにした、macOS 向けの個人設定。

## 中身

| 項目 | 内容 |
| --- | --- |
| フォント | サイズ 14 / `adjust-cell-height = 10%`（フォントは既定。`font-family` 行を外せば BlexMono などに変更可） |
| テーマ | `Mariana`（`ghostty +list-themes` で変更可） |
| ウィンドウ | 透過 0.90 + blur 20 / padding 10 / titlebar transparent |
| 操作性 | `copy-on-select` / クリップボード read・write 許可 / 入力中カーソル非表示 |
| キーバインド | 分割(⌘+Enter=下, ⌘+Shift+Enter=右) / 移動(⌘+矢印) / リサイズ(⌘+Shift+矢印) / ⌘+W で閉じる |
| タブ | ⌘+T で新規 / ⌘+Shift+[ ] で前後移動 |
| ユーティリティ | ⌘+Shift+Z でペイン全画面化 / ⌘+, で設定を開く |

設定は macOS 前提（`cmd` / `macos-*`）。各行にコメントを付けている。

## インストール

```bash
# このリポジトリのルートで
./dotfiles/ghostty/install.sh
```

手動で置く場合:

```bash
# macOS / Linux 共通の設定パス
mkdir -p "${XDG_CONFIG_HOME:-$HOME/.config}/ghostty"
ln -sf "$(pwd)/dotfiles/ghostty/config" "${XDG_CONFIG_HOME:-$HOME/.config}/ghostty/config"
```

反映は Ghostty 上で `⌘ + Shift + ,`（設定リロード）。

## よく使う確認コマンド

```bash
ghostty +list-themes      # テーマをプレビューしながら選ぶ
ghostty +list-fonts       # 使えるフォント名を確認
ghostty +list-actions     # キーバインドに割り当てられるアクション一覧
ghostty +show-config      # 現在の実効設定を表示
```
