# API 仕様（action 一覧）

[← 設計書の目次](../README.md) ／ [共通規約を先に読む](../03-api-conventions.md)

エンドポイントは1本です。`action` の値で分岐します。

```http
POST /exec
Content-Type: text/plain;charset=UTF-8

{ "action": "...", "payload": { ... }, "idToken": "..." }
```

---

## 公開（認証不要）

| action | 用途 | 仕様 |
| --- | --- | --- |
| `courts.list` | コート一覧 | [→](./courts.list.md) |
| `availability.range` | 30分枠の空き状況 | [→](./availability.range.md) |

## 会員（LINE IDトークン）

| action | 用途 | 仕様 |
| --- | --- | --- |
| `auth.me` | 登録状況とプロフィール | [→](./auth.me.md) |
| `auth.register` | プロフィール登録・更新 | [→](./auth.register.md) |
| `reservations.create` | 予約作成 | [→](./reservations.create.md) |
| `reservations.listMine` | 自分の予約一覧 | [→](./reservations.listMine.md) |
| `reservations.cancel` | 自分の予約をキャンセル | [→](./reservations.cancel.md) |

## 管理ログイン（LINE 不要）

| action | 認証 | 用途 | 仕様 |
| --- | --- | --- | --- |
| `admin.login` | 不要 | ID/パスワードでセッション発行 | [→](./admin.login.md) |
| `admin.session` | セッション | 有効性の確認 | [→](./admin.session.md) |
| `admin.logout` | セッション | セッション破棄 | [→](./admin.logout.md) |

## 管理（管理トークン）

| action | 用途 | 仕様 |
| --- | --- | --- |
| `admin.reservations.list` | 予約一覧・検索 | [→](./admin.reservations.list.md) |
| `admin.reservations.create` | カウンター受付（代理予約） | [→](./admin.reservations.create.md) |
| `admin.reservations.cancel` | 管理者によるキャンセル | [→](./admin.reservations.cancel.md) |
| `admin.reservations.markPaid` | 入金を記録 | [→](./admin.reservations.markPaid.md) |
| `admin.reservations.markNoShow` | No-Show を記録 | [→](./admin.reservations.markNoShow.md) |
| `admin.checkin` | 受付（チェックイン） | [→](./admin.checkin.md) |
| `admin.slots.list` | 枠ごとの状態 | [→](./admin.slots.list.md) |
| `admin.slots.set` | 枠設定の置き換え・解除 | [→](./admin.slots.set.md) |
| `admin.slots.bulkUpdate` | 枠設定の追加（旧・非推奨） | [→](./admin.slots.bulkUpdate.md) |
| `admin.broadcast` | LINE 一斉配信 | [→](./admin.broadcast.md) |
| `admin.sales.summary` | 売上集計 | [→](./admin.sales.summary.md) |

---

## 危険度の目安

| 印 | 意味 | 該当 |
| --- | --- | --- |
| 🟢 | 読み取りのみ | `courts.list` / `availability.range` / `auth.me` / `*.list` / `*.listMine` / `admin.session` / `admin.sales.summary` |
| 🟡 | 書き込むが取り消せる | `auth.register` / `reservations.*` / `admin.reservations.cancel` / `admin.slots.*` |
| 🔴 | **取り消せない・外部に影響** | `admin.checkin`（戻せない） / `admin.broadcast`（全員に届く） / `admin.reservations.markPaid`（売上計上） |

---

## 使用しているクライアント

クライアントは**3つ**あります。`hoop-court` の `/admin` は**廃止予定**ですが、現存していて
同じ GAS を参照します。

| # | クライアント | 実装 |
| --- | --- | --- |
| A | LIFF 予約画面（お客様） | `hoop-court` `src/lib/gas.ts` |
| B | **旧 管理画面（廃止予定）** | 同上（`hoop-court` `src/app/admin/`） |
| C | 現行 管理画面 | `himawari-site` `src/lib/gas/client.ts` |

| action | A 予約 | B 旧管理 | C 管理 |
| --- | --- | --- | --- |
| `courts.list` | ✅ | ✅ | ✅ |
| `availability.range` | ✅ | ✅ | ✅ |
| `auth.me` / `auth.register` | ✅ | — | — |
| `reservations.create` / `listMine` / `cancel` | ✅ | — | — |
| `admin.login` / `session` / `logout` | — | ✅ | ✅ |
| `admin.reservations.list` | — | ✅ | ✅ |
| `admin.reservations.markPaid` / `markNoShow` | — | ✅ | ✅ |
| `admin.checkin` | — | ✅ | ✅ |
| `admin.slots.bulkUpdate` | — | ✅ | ✅ |
| `admin.broadcast` / `admin.sales.summary` | — | ✅ | ✅ |
| **`admin.reservations.create` / `cancel`** | — | — | ✅ |
| **`admin.slots.list` / `set`** | — | — | ✅ |

> ⚠ **2026-08 に追加した4 action は、現行の管理画面（C）だけが使います。**
> 旧管理画面（B）は追従していません。B を廃止するまでは、
> **同じ操作が2つの画面から可能**な状態が続きます（同じ GAS・同じデータを見ます）。
