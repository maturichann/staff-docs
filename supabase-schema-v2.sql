-- =====================================
-- Staff Docs v2 - 書類管理システム
-- =====================================

-- =====================================
-- 1. 権限システム
-- =====================================

-- 権限レベルテーブル
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,        -- 'admin', 'mg', 'staff'
  label TEXT NOT NULL,              -- '管理者', 'マネージャー', 'スタッフ'
  level INT NOT NULL,               -- 100=admin, 50=mg, 10=staff（高いほど権限強）
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 初期権限を挿入
INSERT INTO roles (name, label, level) VALUES
  ('admin', '管理者', 100),
  ('mg', 'マネージャー', 50),
  ('staff', 'スタッフ', 10);

-- =====================================
-- 2. プロファイル拡張
-- =====================================

-- 既存のroleカラムをrole_idに移行
ALTER TABLE profiles ADD COLUMN role_id INT REFERENCES roles(id);

-- 既存データを移行
UPDATE profiles SET role_id = (SELECT id FROM roles WHERE name = profiles.role);

-- 古いroleカラムを削除（移行完了後）
-- ALTER TABLE profiles DROP COLUMN role;

-- =====================================
-- 3. フォルダ管理
-- =====================================

CREATE TABLE folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,

  -- 所有者（スタッフ個人フォルダの場合）
  owner_staff_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

  -- アクセス制御
  min_role_level INT DEFAULT 10,      -- 最低閲覧権限レベル

  -- システムフォルダ（その他フォルダなど、削除不可）
  is_system BOOLEAN DEFAULT FALSE,
  system_type TEXT,                   -- 'unassigned', 'submissions' など

  -- メタ情報
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_folders_parent ON folders(parent_id);
CREATE INDEX idx_folders_owner ON folders(owner_staff_id);

-- =====================================
-- 4. ドキュメント拡張
-- =====================================

-- 既存テーブルに列追加
ALTER TABLE documents ADD COLUMN folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN is_locked BOOLEAN DEFAULT FALSE;  -- 鍵マーク（本人非表示）
ALTER TABLE documents ADD COLUMN min_role_level INT DEFAULT 10;    -- 最低閲覧権限
ALTER TABLE documents ADD COLUMN source TEXT DEFAULT 'admin';      -- 'admin' or 'staff'

-- インデックス
CREATE INDEX idx_documents_folder ON documents(folder_id);
CREATE INDEX idx_documents_staff ON documents(staff_id);

-- =====================================
-- 5. スタッフ提出書類システム
-- =====================================

-- 提出依頼テーブル
CREATE TABLE submission_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- 対象（NULLなら全員）
  staff_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

  -- 依頼内容
  title TEXT NOT NULL,              -- '年金手帳', '運転免許証' など
  description TEXT,
  due_date DATE,                    -- 提出期限
  is_required BOOLEAN DEFAULT TRUE, -- 必須かどうか

  -- ステータス
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'rejected')),

  -- メタ情報
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- スタッフ提出書類
CREATE TABLE staff_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- 紐付け
  request_id UUID REFERENCES submission_requests(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

  -- ファイル情報
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,

  -- 提出情報
  submitted_at TIMESTAMPTZ DEFAULT NOW(),

  -- レビュー情報
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  review_note TEXT,                 -- 差し戻し理由など

  -- 承認後の保存先
  saved_document_id UUID REFERENCES documents(id)
);

-- インデックス
CREATE INDEX idx_submissions_staff ON staff_submissions(staff_id);
CREATE INDEX idx_submissions_request ON staff_submissions(request_id);
CREATE INDEX idx_requests_staff ON submission_requests(staff_id);

-- =====================================
-- 6. RLSポリシー
-- =====================================

-- フォルダのRLS
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- 管理者は全フォルダ閲覧可能
CREATE POLICY "Admins can view all folders" ON folders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.level >= 100
    )
  );

-- ユーザーは権限レベル以上のフォルダを閲覧
CREATE POLICY "Users can view folders by role level" ON folders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid()
      AND r.level >= folders.min_role_level
    )
    OR
    -- 自分のフォルダ
    owner_staff_id = auth.uid()
  );

-- 管理者はフォルダ作成・編集・削除可能
CREATE POLICY "Admins can manage folders" ON folders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.level >= 100
    )
  );

-- スタッフは自分のフォルダ内でサブフォルダ作成可能
CREATE POLICY "Staff can create subfolders in own folder" ON folders
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM folders parent
      WHERE parent.id = folders.parent_id
      AND parent.owner_staff_id = auth.uid()
    )
  );

-- ドキュメントのRLS更新
DROP POLICY IF EXISTS "Staff can view own documents" ON documents;
DROP POLICY IF EXISTS "Admins can view all documents" ON documents;

-- 管理者は全ドキュメント閲覧可能
CREATE POLICY "Admins can view all documents" ON documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.level >= 100
    )
  );

-- ユーザーは条件付きで閲覧
CREATE POLICY "Users can view documents" ON documents
  FOR SELECT USING (
    -- 権限レベルチェック
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid()
      AND r.level >= documents.min_role_level
    )
    AND
    -- 鍵マークの場合は本人には見せない
    NOT (documents.is_locked AND documents.staff_id = auth.uid())
    AND
    -- スタッフは自分の書類のみ
    (
      EXISTS (
        SELECT 1 FROM profiles p
        JOIN roles r ON r.id = p.role_id
        WHERE p.id = auth.uid() AND r.level >= 50
      )
      OR documents.staff_id = auth.uid()
      OR documents.staff_name = (SELECT name FROM profiles WHERE id = auth.uid())
    )
  );

-- 提出依頼のRLS
ALTER TABLE submission_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage submission requests" ON submission_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.level >= 50
    )
  );

CREATE POLICY "Staff can view own requests" ON submission_requests
  FOR SELECT USING (
    staff_id = auth.uid() OR staff_id IS NULL
  );

-- スタッフ提出のRLS
ALTER TABLE staff_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage submissions" ON staff_submissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.level >= 50
    )
  );

CREATE POLICY "Staff can manage own submissions" ON staff_submissions
  FOR ALL USING (
    staff_id = auth.uid()
  );

-- =====================================
-- 7. Storageポリシー更新
-- =====================================

-- 提出書類用バケット
INSERT INTO storage.buckets (id, name, public) VALUES ('submissions', 'submissions', false)
ON CONFLICT (id) DO NOTHING;

-- 既存のダウンロードポリシーを更新
DROP POLICY IF EXISTS "Users can download own documents" ON storage.objects;

CREATE POLICY "Users can download documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents' AND
    (
      -- 管理者は全てダウンロード可能
      EXISTS (
        SELECT 1 FROM profiles p
        JOIN roles r ON r.id = p.role_id
        WHERE p.id = auth.uid() AND r.level >= 100
      )
      OR
      -- MGは権限レベル50以下をダウンロード可能
      EXISTS (
        SELECT 1 FROM profiles p
        JOIN roles r ON r.id = p.role_id
        JOIN documents d ON d.file_path = storage.objects.name
        WHERE p.id = auth.uid() AND r.level >= 50 AND d.min_role_level <= 50
      )
      OR
      -- スタッフは自分の書類（鍵マークなし）のみ
      EXISTS (
        SELECT 1 FROM documents d
        JOIN profiles p ON p.id = auth.uid()
        WHERE d.file_path = storage.objects.name
        AND d.staff_name = p.name
        AND d.is_locked = FALSE
      )
    )
  );

-- 提出書類のアップロード（スタッフ可能）
CREATE POLICY "Staff can upload submissions" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'submissions' AND
    auth.uid() IS NOT NULL
  );

-- 提出書類のダウンロード
CREATE POLICY "Users can download submissions" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'submissions' AND
    (
      -- 管理者・MGは全て
      EXISTS (
        SELECT 1 FROM profiles p
        JOIN roles r ON r.id = p.role_id
        WHERE p.id = auth.uid() AND r.level >= 50
      )
      OR
      -- スタッフは自分の提出のみ
      EXISTS (
        SELECT 1 FROM staff_submissions s
        WHERE s.file_path = storage.objects.name
        AND s.staff_id = auth.uid()
      )
    )
  );

-- =====================================
-- 8. システムフォルダ初期化
-- =====================================

-- その他フォルダ（名前なし書類用）
INSERT INTO folders (name, is_system, system_type, min_role_level)
VALUES ('その他', TRUE, 'unassigned', 50);

-- =====================================
-- 9. トリガー・関数
-- =====================================

-- 更新日時自動更新
CREATE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- スタッフ作成時に個人フォルダを自動作成
CREATE OR REPLACE FUNCTION create_staff_folder()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role_id = (SELECT id FROM roles WHERE name = 'staff') THEN
    INSERT INTO folders (name, owner_staff_id, min_role_level, created_by)
    VALUES (NEW.name, NEW.id, 10, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_staff_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION create_staff_folder();
