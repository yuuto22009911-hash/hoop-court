# Ghostty 設定（自分仕様）

[Ghostty](https://ghostty.org) ターミナルの個人設定。
fendo181 さんの記事 [「Ghosttyへ入門する」](https://zenn.dev/fendo181/articles/2b75b12c80fe06)
の「最終的な自分のconfig（2026年1月時点）」の構成を土台に、フォント・テーマ・キーバインドを自分仕様へ調整したもの。

> ℹ️ 元記事の config コードブロックは Zenn 側のアクセス制限で本文を機械取得できなかったため、
> 記事内で解説されている設定値（`font-family = BlexMono Nerd Font Mono` / `font-size = 16`、
> `ghostty +list-themes` からのテーマ選択、キーバインドの解説）に沿って再構成している。
> 元記事の config をそのまま使いたい場合は、その内容を [`config`](./config) に貼り替えれば良い。

## 中身

| 項目 | 内容 |
| --- | --- |
| フォント | `BlexMono Nerd Font Mono` 16px（Nerd Font でアイコン表示） |
| テーマ | `catppuccin-mocha`（ダーク。`ghostty +list-themes` で変更可） |
| ウィンドウ | padding 12 / 透過 0.96 / macOS は blur 有効 |
| キーバインド | ペイン分割・移動(hjkl)・リサイズ・タブ・フォントサイズ・クイックターミナル |
| macOS | `macos-option-as-alt` 有効 |

キーバインドやテーマはコメント付きで、Linux 向けの差分も末尾に併記している。

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
