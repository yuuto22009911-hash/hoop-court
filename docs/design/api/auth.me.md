# `auth.me` 🟢

[← action 一覧](./README.md)

> 種別: **会員** ／ 実装: `authMe_()`

LINE IDトークンの持ち主が会員登録済みかを返します。アプリ起動時の入口チェックです。

## 認証

LINE IDトークン（必須）。

## payload

なし。

## 戻り値

```json
{ "user": { "id": "…", "line_user_id": "U…", "display_name": "山田", "phone": "090-…",
            "email": "…", "team_name": "", "role": "MEMBER",
            "created_at": "…", "updated_at": "…" },
  "registered": true }
```

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `registered` | boolean | `Users` に行があるか |
| `user` | object \| null | 未登録なら `null` |

## エラー

| code | 条件 |
| --- | --- |
| `AUTH` | IDトークンが無い・失効・検証失敗 |
| `CONFIG` | `LINE_LOGIN_CHANNEL_ID` が未設定 |

## 挙動の注意

- **本人の識別は LINE の `sub`（userId）**で行います。`Users.line_user_id` と突き合わせます
- LIFF 側の `LiffGate` がこれを呼び、`registered` が false なら `/register` へ誘導します
