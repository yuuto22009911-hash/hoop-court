# 03. API 共通規約

[← 目次に戻る](./README.md) ／ [action 一覧 →](./api/README.md)

**API を叩く前にこのページを読んでください。** 3つの決まりを外すと動きません。

---

## 1. 通信の3原則（破ると動かない）

```http
POST https://script.google.com/macros/s/{DEPLOY_ID}/exec
Content-Type: text/plain;charset=UTF-8

{"action":"courts.list","payload":{},"idToken":""}
```

| # | 決まり | 理由 |
| --- | --- | --- |
| 1 | `Content-Type` は **`text/plain;charset=UTF-8`** | `application/json` にすると CORS プリフライトが飛び、GAS が対応していないため失敗する |
| 2 | **`redirect: "follow"`** | GAS は 302 で `googleusercontent.com` にリダイレクトする |
| 3 | 認証は**ヘッダではなく body の `idToken`** | GAS はカスタムヘッダを受け取れない |

エンドポイントは**1本だけ**で、`action` の値で処理が分岐します。

---

## 2. リクエストとレスポンスの形

### リクエスト

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `action` | string | 必須。例 `reservations.create` |
| `payload` | object | action ごとの引数。無い場合は `{}` |
| `idToken` | string | 認証が要る action で必須（§3） |

### レスポンス（成功）

```json
{ "ok": true, "data": { ... } }
```

### レスポンス（失敗）

```json
{ "ok": false, "error": "選択した時間帯はすでに予約済みです。", "code": "P0001" }
```

> **HTTP ステータスは常に 200 です。** 成否は `ok` で判定してください。
> `error` は**お客様にそのまま表示できる日本語**にしてあります。

### ヘルスチェック（GET）

```
GET /exec  →  {"ok":true,"data":{"status":"ok","service":"himawari-hoop-court-gas"}}
```

デプロイの生存確認に使います。`service` の値で**本番プロジェクトかどうか**を判別できます。

---

## 3. 認証

`idToken` フィールドに入れる値が2系統あります。**GAS 側が形式で自動判別します。**

| 系統 | 値 | 発行元 | 有効期限 |
| --- | --- | --- | --- |
| LINE IDトークン | JWT（長い） | LIFF (`liff.getIDToken()`) | 1時間（フロントが55分ごとに再取得） |
| 管理セッション | 64桁の hex | `admin.login` | 6時間（アクセスのたびに延長） |

### 判定の流れ（`requireAdmin_`）

```
idToken が 64桁hex か？
  ├─ Yes → CacheService に該当セッションがあるか？
  │          ├─ ある → 管理者として通す（via: "password"）
  │          └─ ない → LINE 検証へ
  └─ No  → LINE の verify API で検証
             → ADMIN_USER_IDS または Admins シートに userId があるか？
                ├─ ある → 管理者として通す（via: "line"）
                └─ ない → FORBIDDEN
```

会員向け action（`auth.*` / `reservations.*`）は LINE IDトークンのみを受け付けます。

### 認可の区分

| 区分 | 必要なもの | 該当 action |
| --- | --- | --- |
| 公開 | 不要 | `courts.list` / `availability.range` / `admin.login` |
| 会員 | LINE IDトークン | `auth.*` / `reservations.*` |
| 管理 | 管理セッション または 許可リストの LINE 管理者 | `admin.*`（`admin.login` を除く） |

---

## 4. 日時の扱い

| 決まり | 内容 |
| --- | --- |
| タイムゾーン | **JST 固定**。`Asia/Tokyo` |
| 形式 | ISO8601 + オフセット `2026-08-01T10:00:00+09:00` |
| 終了時刻 | **排他**。`10:00〜11:00` は `starts_at=10:00`, `ends_at=11:00` |
| 期間指定（`from` / `to`） | `to` は**含まない**。1日分は `T00:00:00+09:00` 〜 翌日 `T00:00:00+09:00` |
| 枠の単位 | 30分。営業時間 9:00〜20:00 の 22 枠 |

> ⚠ フロントが `Date` を `toISOString()` で送ると UTC 表記（`Z`）になりますが、GAS 側は
> `new Date()` で解釈してから JST に整形するため問題ありません。
> ただし**新規実装では `+09:00` 表記を推奨**します（ログが読みやすいため）。

---

## 5. エラーコード一覧

### 共通

| code | 意味 | 典型的な原因 |
| --- | --- | --- |
| `AUTH` | 認証失敗 | 未ログイン、IDトークン失効、セッション切れ |
| `FORBIDDEN` | 権限なし | 管理者リストに無い、他人の予約を操作 |
| `NOT_FOUND` | 対象が見つからない | 予約IDの誤り |
| `VALIDATION` | 入力不正 | 必須項目が空、値が想定外 |
| `CONFIG` | 設定不足 | シート・列・スクリプトプロパティが無い |
| `BAD_REQUEST` | 未知の action | **デプロイが古い可能性** |
| `UNREGISTERED` | 会員未登録 | プロフィール登録前に予約しようとした |
| `ALREADY_CHECKED_IN` | 受付済み | 二重チェックイン |
| `BROADCAST` | 配信失敗 | Messaging API のエラー |
| `ERROR` | その他 | 想定外の例外 |

### 予約ルール（P コード）

| code | 意味 |
| --- | --- |
| `P0001` | 時間帯が重複（貸切済み／貸切枠へのフリー） |
| `P0002` | 終了時刻が開始時刻以前 |
| `P0004` | 営業時間（9:00〜20:00）外 |
| `P0005` | **開始時刻が現在より過去**（当日でも未来なら可） |
| `P0006` | フリーは30分単位 |
| `P0007` | フリーの人数が 1〜9 名の範囲外 |
| `P0008` | その時間帯のフリー残人数が不足 |
| `P0009` | 貸切は1時間以上・30分単位 |
| `P0010` | コートが見つからない |
| `P0011` | 土日祝の貸切は1時間単位 |

### クライアント側で付けるコード（GAS は返さない）

| code | 意味 | 対応 |
| --- | --- | --- |
| `NETWORK` | 通信失敗 | 再試行を促す |
| `TIMEOUT` | 30秒応答なし | **再送信させない。** サーバー側で成立している可能性がある |

---

## 6. 冪等性と再送

| action | 再送したときの挙動 |
| --- | --- |
| `admin.reservations.cancel` | **冪等**。2回目は `already: true` を返すだけ |
| `admin.slots.set` | **冪等**。同じ指定なら結果は同じ |
| `admin.reservations.markPaid` | 冪等（`paid_at` が上書きされる） |
| `reservations.create` / `admin.reservations.create` | **冪等でない。二重予約になる** |
| `admin.checkin` | 2回目は `ALREADY_CHECKED_IN` |

> ⚠ 予約作成には冪等キーがありません。**応答が返らなかったときは再送せず、
> 一覧で検索して確認**してください（管理画面はそう作ってあります）。

---

## 7. 排他制御

`LockService.getScriptLock()` を 20 秒待機で取得します。

| action | ロック内で行うこと |
| --- | --- |
| `reservations.create` / `admin.reservations.create` | 重複判定 → 金額算出 → 行追記 |
| `admin.slots.set` | 重なる行の収集 → 削除 → 残余の再挿入 |
| `auth.register` | 既存確認 → 追記または更新 |

LINE 通知は**ロックを解放した後**に送ります（通知の失敗で予約を失敗させないため）。
