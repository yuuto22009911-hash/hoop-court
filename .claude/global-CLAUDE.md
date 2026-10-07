# Global Personal Instructions

## 言語
- **常に日本語で会話する**（コミットメッセージ・PR本文・ドキュメントもプロジェクト方針に従いつつ、対話は日本語）

## 動作モード
- **自律モード既定**: 「進めてよいですか」「どちらにしますか」型の確認は出さない。最適と判断した方法で即実行する
- **確認ダイアログ制御**: `auto-approve.sh` フックで以下の通り厳密制御されている：
  - **`rm` / `rmdir` / `trash` / `find -delete` / `find -exec rm` のみ ask**（ユーザー確認）
  - その他すべてのコマンド・編集は **allow 自動承認**（git push、vercel --prod、保護パス書き込みも含む）
  - 破壊系（sudo、mkfs、shutdown、git filter-branch、force push to main/master、rm -rf に / ~ $HOME * ..）は **safety-net.sh で exit 2 即拒否**（確認なし）
- **例外（コードでなくユーザーへの言葉で確認すべき）**:
  - 金銭・契約・公開発信（決済、サブスク、SNS投稿、メール送信）
  - ユーザー本人にしかできない物理操作（QR、2FA、メール認証クリック）

## ブラウザ操作（全プロジェクト共通・必ず守る）
- **ブラウザ操作をユーザーに依頼しない。Claude Code 自身が Claude in Chrome（`mcp__claude-in-chrome__*`）で実行する**
  - 「この画面を開いて〜してください」「Claude in Chrome に貼るプロンプト」を作って渡すのは禁止
  - ユーザーのログイン済みセッションが要るので、内蔵ブラウザではなく Claude in Chrome を既定にする
- **自分で実行できない操作（削除・購入・課金・送信・契約・パスワード入力・2FA・CAPTCHA など）も、実行直前の画面まで Claude が遷移させる**
  - 例: 購入なら商品選択・数量・配送先選択まで進め、「注文を確定」ボタンがある最終確認画面で止める
  - 例: 削除なら対象を選択し、削除確認ダイアログを開いた状態で止める
  - 止めたら「どのタブの・どのボタンを押せば完了か」と、画面に出ている金額・対象などの要点をユーザーに伝える
  - 最後の確定クリックと、認証情報・カード番号の入力だけをユーザーに残す

## セッション名（全プロジェクト共通・必ず守る）
- **新しいセッションを始めたら、最初の応答の中で `set_session_title`（session_id: "self"）を使い、「システム名 バージョン」に名前を変える**
  - 対象はプロジェクトフォルダで始めたセッションのみ。フォルダなし（scratch）のセッションは対象外
- 名前は **同じプロジェクトの過去のセッション名** から決める（`list_sessions` を `include_archived: true` で呼び、cwd またはサイドバーのグループが同じものを見る）
  - システム名: 過去の「〇〇 vX」形式の名前の〇〇をそのまま使う（例: `Aviy` / `Novi UI` / `MonoFloras Webサイト`）
  - バージョン: そのプロジェクトで最大のバージョンを、過去と同じ刻み方で1つ上げる
    - 小数で刻んでいる → 末尾を +1（`Aviy v1.2` → `Aviy v1.3`）
    - 整数で刻んでいる → +1（`MonoFloras Webサイト v4` → `MonoFloras Webサイト v5`）
  - `(fork)` 付きの名前と、「〇〇 vX」形式でない名前は判定に使わない
  - 「〇〇 vX」形式の前例がない → システム名はサイドバーのグループ名（なければフォルダ名）、バージョンは `v1.0`
- 改名したら、付けた名前を応答の中で一言伝える

## 開発の基本原則
- **小さく作って速く動かす**: 1機能=1PR、コミットは小さく頻繁に
- **テストファースト**: 新機能は `/tdd` でRed→Green→Refactorを徹底
- **計測ファースト**: 最適化は必ず Before/After を数値で示す
- **過剰抽象化禁止**: 3回以上の重複が出てから抽象化する（YAGNI）
- **副作用は境界に閉じる**: 純粋関数を主体に、IO/State は境界レイヤへ
- **失敗時の挙動を最初に決める**: エラーハンドリング・リトライ・タイムアウトを実装より先に設計

## ワークフロー（即日納品スタイル）
1. `/context-prime` で全体把握
2. `/spec` で要件→設計→タスク3点セット生成（軽量案件は `/spec-light`）
3. 並列サブエージェントで実装（frontend/backend/test/docs）
4. `/check` で品質ゲート通過
5. `/ship` でテスト→commit→PR→デプロイURL取得まで一気通貫

## Webデザイン作成（毎回同じ工程・必ず守る）
HP / LP / SaaS / LIFF の UI/デザイン依頼を受けたら **必ず**：
- 最初に `/design-init <hp|saas|liff> <ブランド名>` を実行
- 複雑な実装は `ui-designer` サブエージェントに委任
- テンプレは `~/.claude/templates/design/` のものを使う（手書き禁止）
- 土台: **shadcn/ui + Tailwind v4 + OKLCH semantic tokens + Bento Grid**
- ブランド色は OKLCH の hue だけ差し替え（chroma=0.18 基準）
- アクセシビリティ厳守: WCAG 2.2 / tap target 48x48 / input 16px / `viewport-fit=cover` / `prefers-reduced-motion`
- パフォーマンス目標: Lighthouse 90+、LCP≤2.5s / INP≤200ms / CLS≤0.1
- LIFF特有: LINE Green (#06C755) は LINE 機能ボタンのみ。自社 primary とは別色
- アンチパターン禁止: Bootstrap 4風 / 過剰グラデ / 同じ大きさカード / Glass+薄文字 / 純黒シャドウ / スクロール乗っ取り

## 仕様書作成（毎回同じ工程・必ず守る）
仕様書/設計書/要件定義/PRD/SDD/Spec の依頼を受けたら **必ず** 以下：
- 規模判定: 3人日未満 → `/spec-light`、それ以上 → `/spec`
- テンプレは `~/.claude/templates/specs/` のものを使う（手書き禁止）
- **RFC 2119 宣言**を冒頭に必ず入れる（MUST/SHOULD/MAY を大文字運用）
- 受け入れ基準は **Given-When-Then 形式**（正常系1+異常系1必須）
- 機能要件は **EARS 記法**（Ubiquitous/Event-driven/State-driven/Optional/Unwanted）
- 非機能要件は **数値で**書く（"fast"/"快適"等の曖昧語禁止）
- 各タスクに **AC-XX-X / FR-XX を必ず紐付け**（要件追跡可能性）
- Status: Draft → In Review → Approved → Implemented で運用、Open Questions 未解決なら次フェーズに進まない

## 横断知識ベース（Obsidian vault）
全プロジェクトのインデックス・横断知見・決定ログは `~/Obsidian` にある。入口は `00_ハブ.md`。
- **vault は正本ではない**。仕様書の本体は各リポジトリの `.claude/specs/`。vault にコピーを作らない（二重メンテで必ず腐る）
- 読みに行くべき時: `/spec` の前に類似仕様を探す / 過去の技術判断の理由を調べる / 複数案件を横断して調べる
- 主要ノート: `20_仕様書/仕様書マスタ.md`（全仕様の所在）/ `30_共通ルール/共通コード規約.md` / `40_決定ログ/`（ADR）
- **更新義務**: 新しいプロジェクトを始めたら `10_プロジェクト/` にノートを作り `00_ハブ.md` に載せる（spec が無い案件も対象）。プロジェクトのパス・構造・リモート・spec の Status を変えたら、vault の該当ノートも同じセッション内で直す
- 横断的な調べ物は `~/Obsidian` で、実装は各リポジトリで起動する

## コミット規約
- Conventional Commits 厳守: `<type>(<scope>): <subject>`
- type: feat / fix / refactor / perf / test / docs / chore / build / ci
- subject は命令形・現在形・小文字（英語の場合）
- 本文には「なぜ」を必ず含める（whatはdiffで分かる）

## レビュー方針
- 自分のコードはマージ前に必ず `code-reviewer` エージェントに通す
- 認証・暗号・入力処理を書いたら `security-auditor` を必須起動
- アーキ判断が絡むなら `architect-reviewer` で評価

## ツール選択の優先順
1. プロジェクト既存のスクリプト（package.json scripts 等）
2. 標準ツール（git CLI、gh、公式 SDK）
3. MCPサーバー（github / playwright / context7）
4. WebFetch / WebSearch
5. スクレイピングや非標準手段は最終手段

## 不要な装飾を避ける
- コメントはWHYのみ。WHATは命名で表現
- 「used by X」「fixed for issue Y」など履歴系コメント禁止（diffとPR本文に書く）
- 絵文字はユーザーが明示的に使った時のみ
- ドキュメントの「予防的説明」禁止。実コードに無いものを書かない

## エラー処理ポリシー
- 内部関数で起きないエラーは握り潰さない（panicしてOK）
- ユーザー入力・外部API・FSはすべてバリデーション境界
- ログにシークレットを出さない（自動マスキング前提でも）

## セキュリティ既定
- `.env` `.env.local` `.env.production` はreadもwriteもしない
- `~/.ssh/` `~/.aws/` `~/.gnupg/` はreadもwriteもしない
- `curl ... | sh` 形式の実行は絶対にしない
- 秘密情報はコミットしない（疑わしいものは即停止して確認）
