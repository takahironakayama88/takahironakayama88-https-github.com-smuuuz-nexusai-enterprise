# sunsun - TODO

## B2B ユーザー管理機能

OWNERがダッシュボードからユーザーを作成・管理できる機能。
運用フロー: サービス提供者が組織+OWNERを発行 → OWNERがダッシュボードからユーザーを追加・管理。

### API（新規作成）

- [ ] `GET /api/users` - 自組織ユーザー一覧（OWNER専用）
- [ ] `POST /api/users` - ユーザー作成（email, password, role）
- [ ] `PUT /api/users/[id]` - ユーザー更新（メール変更、パスワードリセット、ロール変更）
- [ ] `DELETE /api/users/[id]` - ユーザー削除（自分自身は削除不可）

### UI（新規作成）

- [ ] `components/user-management/UserManagementSection.tsx` - ユーザー管理パネル
  - ユーザー一覧テーブル（メール/ロール/作成日/操作）
  - ユーザー追加ダイアログ（パスワード自動生成、コピーボタン付き）
  - ユーザー編集ダイアログ（パスワードリセット、ロール変更）
  - ユーザー削除確認ダイアログ

### ダッシュボード修正

- [ ] `app/dashboard/page.tsx` にユーザー管理タブを追加（OWNER専用）

### セキュリティ要件

- 全エンドポイントでOWNER権限チェック
- ユーザー操作は自組織スコープ内のみ
- 自分自身の削除/ロール降格を禁止
- 全操作を監査ログに記録（user_create, user_update, user_delete）
- パスワードはSHA256ハッシュ化（既存方式と統一）

### 備考

- スキーマ変更は不要（既存のOrganization/User/UserRoleモデルで対応可能）
- 既存の `recordAudit()` をそのまま利用可能
- 詳細な実装計画: `.claude/plans/fluttering-discovering-stallman.md`
