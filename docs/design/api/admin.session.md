# `admin.session` 🟢

[← action 一覧](./README.md)

> 種別: **管理** ／ 実装: `adminSession_()`

いま持っているトークンが有効かを確認します。管理画面の入口（`AdminGate`）が使います。

## 認証

管理トークン、または許可リストの LINE 管理者。

## payload

なし。

## 戻り値

```json
{ "ok": true, "username": "himawari-admin", "via": "password" }
```

| フィールド | 説明 |
| --- | --- |
| `via` | `password`（ID/パスワード経由） / `line`（LINE 管理者） |
| `username` | パスワード経路ならログインID、LINE 経路なら表示名 |

## エラー

| code | 条件 |
| --- | --- |
| `AUTH` | トークンが無効・失効 |
| `FORBIDDEN` | LINE 認証は通ったが管理者リストに無い |

## 挙動の注意

- **呼ぶだけでセッションが6時間延長されます**（スライディング期限）
- 管理画面はページ読み込みのたびにこれを呼び、失敗したらログイン画面へ戻します
