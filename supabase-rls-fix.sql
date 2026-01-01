-- =====================================
-- Staff Docs - RLS ポリシー修正
-- =====================================
--
-- このファイルは循環参照問題を解決するための
-- シンプルなRLSポリシーを設定します。
-- 権限制御はアプリケーション側で行います。
--
-- 実行順序:
-- 1. このファイルを実行してRLSを修正
-- =====================================

-- =====================================
-- 1. roles テーブル
-- =====================================
ALTER TABLE roles DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read roles" ON roles;
DROP POLICY IF EXISTS "Anyone can read roles" ON roles;
DROP POLICY IF EXISTS "read_roles" ON roles;
DROP POLICY IF EXISTS "allow_all_roles" ON roles;

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_roles" ON roles FOR SELECT USING (true);

-- =====================================
-- 2. profiles テーブル
-- =====================================
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can create profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can manage profiles" ON profiles;
DROP POLICY IF EXISTS "Managers can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Authenticated read profiles" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;
DROP POLICY IF EXISTS "read_profiles" ON profiles;
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
DROP POLICY IF EXISTS "insert_profiles" ON profiles;
DROP POLICY IF EXISTS "delete_profiles" ON profiles;
DROP POLICY IF EXISTS "allow_all_profiles" ON profiles;
DROP POLICY IF EXISTS "allow_update_own" ON profiles;
DROP POLICY IF EXISTS "allow_insert_profiles" ON profiles;
DROP POLICY IF EXISTS "allow_delete_profiles" ON profiles;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "insert_profiles" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "delete_profiles" ON profiles FOR DELETE USING (true);

-- =====================================
-- 3. documents テーブル
-- =====================================
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can view own documents" ON documents;
DROP POLICY IF EXISTS "Admins can view all documents" ON documents;
DROP POLICY IF EXISTS "Admins can create documents" ON documents;
DROP POLICY IF EXISTS "Admins can delete documents" ON documents;
DROP POLICY IF EXISTS "Users can view documents" ON documents;
DROP POLICY IF EXISTS "read_documents" ON documents;
DROP POLICY IF EXISTS "insert_documents" ON documents;
DROP POLICY IF EXISTS "update_documents" ON documents;
DROP POLICY IF EXISTS "delete_documents" ON documents;

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_documents" ON documents FOR SELECT USING (true);
CREATE POLICY "insert_documents" ON documents FOR INSERT WITH CHECK (true);
CREATE POLICY "update_documents" ON documents FOR UPDATE USING (true);
CREATE POLICY "delete_documents" ON documents FOR DELETE USING (true);

-- =====================================
-- 4. folders テーブル
-- =====================================
ALTER TABLE folders DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view all folders" ON folders;
DROP POLICY IF EXISTS "Users can view folders by role level" ON folders;
DROP POLICY IF EXISTS "Admins can manage folders" ON folders;
DROP POLICY IF EXISTS "Staff can create subfolders in own folder" ON folders;

ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_folders" ON folders FOR SELECT USING (true);
CREATE POLICY "insert_folders" ON folders FOR INSERT WITH CHECK (true);
CREATE POLICY "update_folders" ON folders FOR UPDATE USING (true);
CREATE POLICY "delete_folders" ON folders FOR DELETE USING (true);

-- =====================================
-- 5. submission_requests テーブル
-- =====================================
ALTER TABLE submission_requests DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage submission requests" ON submission_requests;
DROP POLICY IF EXISTS "Staff can view own requests" ON submission_requests;

ALTER TABLE submission_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_requests" ON submission_requests FOR SELECT USING (true);
CREATE POLICY "insert_requests" ON submission_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "update_requests" ON submission_requests FOR UPDATE USING (true);
CREATE POLICY "delete_requests" ON submission_requests FOR DELETE USING (true);

-- =====================================
-- 6. staff_submissions テーブル
-- =====================================
ALTER TABLE staff_submissions DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage submissions" ON staff_submissions;
DROP POLICY IF EXISTS "Staff can manage own submissions" ON staff_submissions;

ALTER TABLE staff_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_submissions" ON staff_submissions FOR SELECT USING (true);
CREATE POLICY "insert_submissions" ON staff_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "update_submissions" ON staff_submissions FOR UPDATE USING (true);
CREATE POLICY "delete_submissions" ON staff_submissions FOR DELETE USING (true);

-- =====================================
-- 注意事項
-- =====================================
--
-- このRLS設定では、認証済みユーザーは全てのデータに
-- アクセスできます。実際の権限制御は以下で行っています:
--
-- 1. API層 (/api/admin/*) - 管理者チェック
-- 2. アプリ層 - canViewDocument(), filterFoldersByPermission()
-- 3. Storage RLS - documents/submissions バケット
--
-- Storageのポリシーは別途設定が必要です。
