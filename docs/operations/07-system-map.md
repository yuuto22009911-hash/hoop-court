# 操作 ↔ システム 対応表

[← 運用ガイド](./README.md)

**すべての操作**が、どの画面を通り、どの action を呼び、何を書き換えるかの一覧です。

---

## 1. お客様の操作（📱 LIFF 予約アプリ）

| 操作 | action | 書き換わるもの | シナリオ |
| --- | --- | --- | --- |
| アプリを開く | `auth.me` | — | [S-01](./02-scenarios-booking.md#s-01) |
| （コート情報の取得） | `courts.list` | — | 〃 |
| カレンダー・時刻表を見る | `availability.range` | — | 〃 |
| プロフィール登録 | `auth.register` | **Users**（追加/更新） | [S-02](./02-scenarios-booking.md#s-02) |
| 予約を確定する | `reservations.create` | **Reservations**（追加） | [S-01](./02-scenarios-booking.md#s-01) |
| マイページを見る | `reservations.listMine` | — | [S-07](./03-scenarios-visit.md#s-07) |
| 自分の予約をキャンセル | `reservations.cancel` | **Reservations**（status） | [S-12](./04-scenarios-change.md#s-12) |

---

## 2. 運営の操作（🖥 管理画面）

### 認証

| 操作 | action | 書き換わるもの | シナリオ |
| --- | --- | --- | --- |
| 管理ログイン | `admin.login` | — （セッション発行） | [1日の流れ](./01-daily-flow.md) |
| 画面を開くたび | `admin.session` | — | 〃 |
| ログアウト | `admin.logout` | — （セッション破棄） | 〃 |

### 予約

| 操作 | action | 書き換わるもの | シナリオ |
| --- | --- | --- | --- |
| 予約一覧・検索 | `admin.reservations.list` | — | [S-08](./03-scenarios-visit.md#s-08) |
| カウンター受付（代理予約） | `admin.reservations.create` | **Reservations**（追加） | [S-06](./02-scenarios-booking.md#s-06) [S-10](./03-scenarios-visit.md#s-10) [S-11](./03-scenarios-visit.md#s-11) |
| 管理者キャンセル | `admin.reservations.cancel` | **Reservations**（status・理由・実行者） | [S-13](./04-scenarios-change.md#s-13) [S-15](./04-scenarios-change.md#s-15) [S-17](./04-scenarios-change.md#s-17) |
| 受付（チェックイン） 🔴 | `admin.checkin` | **Reservations**（status・受付時刻） | [S-07](./03-scenarios-visit.md#s-07) [S-08](./03-scenarios-visit.md#s-08) |
| 入金を記録 🔴 | `admin.reservations.markPaid` | **Reservations**（入金状態） | [S-09](./03-scenarios-visit.md#s-09) |
| No-Show を記録 | `admin.reservations.markNoShow` | **Reservations**（status） | [S-14](./04-scenarios-change.md#s-14) |

### 枠

| 操作 | action | 書き換わるもの | シナリオ |
| --- | --- | --- | --- |
| 週の状態を見る | `admin.slots.list` | — | [S-20](./05-scenarios-slots.md#s-20) |
| 1枠ずつ開閉 | `admin.slots.set` | **Slots**（追加・削除） | [S-18](./05-scenarios-slots.md#s-18) [S-19](./05-scenarios-slots.md#s-19) |
| 期間をまとめて設定 | `admin.slots.bulkUpdate` | **Slots**（追加のみ） | [S-21](./05-scenarios-slots.md#s-21) |

### その他

| 操作 | action | 書き換わるもの | シナリオ |
| --- | --- | --- | --- |
| 売上を見る | `admin.sales.summary` | — | [S-22](./05-scenarios-slots.md#s-22) |
| 一斉配信 🔴 | `admin.broadcast` | — （LINE に送信） | [S-23](./05-scenarios-slots.md#s-23) |

🔴 = **取り消せない、または外部に影響する操作**

---

## 3. 予約の状態が変わる操作の一覧

```
                        ┌───────────────┐
  reservations.create   │               │
  admin.reservations    │  CONFIRMED    │
       .create ────────▶│               │
                        └───────────────┘
                          │     │     │
        admin.checkin     │     │     │  admin.reservations.markNoShow
              ┌───────────┘     │     └───────────┐
              ▼                 │                 ▼
      ┌───────────────┐         │         ┌───────────────┐
      │  COMPLETED    │         │         │   NO_SHOW     │
      └───────────────┘         │         └───────────────┘
              │                 │                 │
              │   reservations.cancel（会員・本人のみ）
              │   admin.reservations.cancel（管理者・どの状態からでも）
              └─────────────────┼─────────────────┘
                                ▼
                        ┌───────────────┐
                        │   CANCELED    │
                        └───────────────┘
```

| 状態 | 意味 | 重複判定の対象 | 売上の対象 |
| --- | --- | --- | --- |
| `CONFIRMED` | 予約確定 | ✅ **枠を占有する** | 入金済みなら ✅ |
| `COMPLETED` | 受付済み（来場した） | ❌ 外れる | 入金済みなら ✅ |
| `NO_SHOW` | 来なかった | ❌ 外れる | 入金済みなら ✅ |
| `CANCELED` | キャンセル | ❌ 外れる | **入金済みなら ✅（要注意）** |

> ⚠ **売上は `status` を見ていません。** `payment_status` だけを見ます。
> キャンセルしても入金済みのままなら計上されます（[S-15](./04-scenarios-change.md#s-15)）。

---

## 4. 入金の状態が変わる操作

| 操作 | `payment_status` | 備考 |
| --- | --- | --- |
| `reservations.create`（アプリ） | `UNPAID` | 必ず未入金で作られる |
| `admin.reservations.create`（支払い方法なし） | `UNPAID` | |
| `admin.reservations.create`（支払い方法あり） | **`PAID`** | その場で売上計上 |
| `admin.reservations.markPaid` | **`PAID`** | 受付後に記録 |
| **戻す操作** | — | **無い。📊 シートを直接修正**（[T-06](./06-scenarios-trouble.md#t-06)） |

---

## 5. シートが書き換わる操作の一覧

| シート | 書き換える action |
| --- | --- |
| **Reservations** | `reservations.create` / `reservations.cancel` / `admin.reservations.create` / `admin.reservations.cancel` / `admin.reservations.markPaid` / `admin.reservations.markNoShow` / `admin.checkin` |
| **Users** | `auth.register` |
| **Slots** | `admin.slots.set` / `admin.slots.bulkUpdate` |
| **Courts** | **どの action も書き換えません**（📊 で直接編集） |
| **Admins** | 同上 |
| **AdminAuth** | `setAdminLogin()`（エディタから手動実行） |

---

## 6. カバレッジ

**全21 action が、いずれかのシナリオに登場します。**

| 分類 | action 数 | 登場するシナリオ |
| --- | --- | --- |
| 公開 | 2 | S-01, S-03, S-05, S-11, S-20 |
| 会員 | 5 | S-01, S-02, S-04, S-07, S-12 |
| 管理ログイン | 3 | 1日の流れ, T-04 |
| 管理 | 11 | S-06〜S-23, T-01〜T-09 |

対応表の網羅性は CI ではなく手作業で維持しています。
**action を追加したら、このファイルとシナリオの両方に追記してください。**
