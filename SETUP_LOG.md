# NexusAI Enterprise セットアップログ

## プロジェクト概要

- **アプリ名**: sunsun (NexusAI Enterprise)
- **技術スタック**: Next.js 16, React 19, TypeScript 5.9, Prisma ORM 6.19, Tailwind CSS 4
- **AI対応**: OpenAI / Anthropic / Google（Vercel AI SDK経由）
- **認証**: JWT（jsonwebtoken）
- **暗号化**: AES-256-GCM（APIキー保管用）
- **GitHub**: https://github.com/takahironakayama88/takahironakayama88-https-github.com-smuuuz-nexusai-enterprise
- **本番URL**: https://takahironakayama88-https-github-com.vercel.app

---

## 1. 初期状態の確認

- localhost:3000 で動作するNext.jsアプリを確認
- SQLiteをローカルDBとして使用していた
- 主要機能: マルチテナント対応AIチャット、組織管理、ユーザー管理（OWNER/ADMIN/MEMBER）、監査ログ

## 2. GitHubへの初回プッシュ

- 11ファイルの変更 + 2つの未追跡ファイルをコミット
- `prisma/dev.db` と `tsconfig.tsbuildinfo` は `.gitignore` に追加して除外
- `origin/main` にプッシュ完了

## 3. SQLite → Supabase（PostgreSQL）移行

### 移行前の互換性チェック

- Raw SQLなし（全てPrisma ORM経由） → 問題なし
- CUID主キー → PostgreSQL互換
- DateTime処理 → 互換
- JSON文字列ハンドリング（5ファイル）→ 軽微な最適化可能だが問題なし

### 移行手順

1. Supabaseプロジェクト作成（リージョン: ap-northeast-1）
   - Data API: OFF（supabase-jsは使用しないため）
2. `prisma/schema.prisma` の `provider` を `sqlite` → `postgresql` に変更
3. `directUrl` を追加（マイグレーション用の直接接続）
4. 旧SQLiteマイグレーションを削除
5. `npx prisma migrate dev --name init` で新規PostgreSQLマイグレーション生成
6. `npx prisma db seed` でデモデータ投入
7. ローカルで動作確認 → 成功

### デモデータ

| メール | パスワード | ロール |
|--------|-----------|--------|
| owner@demo.com | demo123 | OWNER |
| member@demo.com | demo123 | MEMBER |

## 4. Vercelデプロイ

### ビルド設定

- `package.json` の build スクリプトを更新: `"build": "prisma generate && next build"`
- Vercelダッシュボードからデプロイ（GitHub連携）

### 環境変数（Vercel Settings → Environment Variables）

| 変数名 | 用途 |
|--------|------|
| `DATABASE_URL` | Supabase コネクションプーラー（ポート6543） |
| `DIRECT_URL` | Supabase 直接接続（ポート5432） |
| `ENCRYPTION_KEY` | AES-256-GCM暗号化用マスターキー |
| `JWT_SECRET` | JWT認証用シークレット |

### トラブルシューティング

#### 問題1: Vercel Deployment Protection

- **症状**: APIリクエストがHTMLの認証ページを返す
- **原因**: Vercel Authenticationが有効になっていた
- **解決**: Settings → Deployment Protection → Vercel Authentication を無効化

#### 問題2: データベース接続エラー

- **症状**: `Can't reach database server at db.hqyiguesecjtypxemlkx.supabase.co:5432`
- **原因**: パスワード `FJ)*J5sv)Vty` の特殊文字（`)`, `*`）がURLパーサーで正しく解釈されなかった
- **解決**:
  1. Supabaseのパスワードを英数字のみに変更
  2. `DATABASE_URL` をコネクションプーラー（ポート6543）に切り替え
  3. `DIRECT_URL` は直接接続（ポート5432）を維持
  4. Vercel環境変数を更新 → 再デプロイで解決

### 接続構成（最終）

```
DATABASE_URL = postgresql://postgres.PROJECT_REF:PASSWORD@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL   = postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres
```

- **DATABASE_URL**: コネクションプーラー経由（サーバーレス環境に最適、`?pgbouncer=true` 付き）
- **DIRECT_URL**: 直接接続（Prismaマイグレーション用）

## 5. .gitignore 設定

```
node_modules
.next
.env
.env.local
.env*.local
/app/generated/prisma
prisma/dev.db
tsconfig.tsbuildinfo
.vercel
```

---

*最終更新: 2026-02-05*
