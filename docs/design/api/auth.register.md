# `auth.register` 🟡

[← action 一覧](./README.md)

> 種別: **会員** ／ 実装: `authRegister_()`

プロフィールを登録します。**すでに登録済みなら更新**します（upsert）。

## 認証

LINE IDトークン（必須）。

## payload

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `display_name` | string | ✅ | 氏名 |
| `phone` | string | ✅ | 電話番号 |
| `email` | string | ✅ | メールアドレス |
| `team_name` | string | | 団体名 |

## 戻り値

```json
{ "registered": true }
```

## エラー

| code | 条件 |
| --- | --- |
| `AUTH` | IDトークン不正 |
| `VALIDATION` | `display_name` / `phone` / `email` のいずれかが空 |

## 挙動の注意

- **`line_user_id` で既存行を探し、あれば更新・無ければ追加**します。重複行は作られません
- 更新時は `display_name` / `phone` / `email` / `team_name` / `updated_at` のみ書き換えます
- `LockService`（20秒）の中で実行します
- 形式の検証（メールの妥当性など）は**していません**。フロント側の `type` 属性に依存しています
