-- =====================================
-- Staff Docs - 完全スキーマ
-- =====================================
--
-- 使用方法:
-- 1. Supabase Dashboard → SQL Editor
-- 2. 既存のテーブルを削除（下記のDROP文を実行）
-- 3. このファイル全体を実行
--
-- 注意: 既存データは全て削除されます
-- =====================================

-- =====================================
-- 0. 既存のテーブル・ポリシーを削除
-- =====================================

-- Storage ポリシー削除
DROP POLICY IF EXISTS "Admins can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can download own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can download documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete documents" ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload submissions" ON storage.objects;
DROP POLICY IF EXISTS "Users can download submissions" ON storage.objects;
DROP POLICY IF EXISTS "admins_upload_documents" ON storage.objects;
DROP POLICY IF EXISTS "users_download_documents" ON storage.objects;
DROP POLICY IF EXISTS "admins_delete_documents" ON storage.objects;
DROP POLICY IF EXISTS "staff_upload_submissions" ON storage.objects;
DROP POLICY IF EXISTS "users_download_submissions" ON storage.objects;

-- トリガー削除（テーブル削除前に）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 関数削除
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.create_staff_folder() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role_level() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_name() CASCADE;

-- テーブル削除（依存関係順）
DROP TABLE IF EXISTS staff_submissions CASCADE;
DROP TABLE IF EXISTS submission_requests CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS folders CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- =====================================
-- 1. 権限システム
-- =====================================

CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  level INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO roles (name, label, level) VALUES
  ('admin', '管理者', 100),
  ('mg', 'マネージャー', 50),
  ('staff', 'スタッフ', 10);

-- =====================================
-- 2. プロファイル
-- =====================================

CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role_id INT REFERENCES roles(id) DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================
-- 3. フォルダ
-- =====================================

CREATE TABLE folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  owner_staff_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  min_role_level INT DEFAULT 10,
  is_system BOOLEAN DEFAULT FALSE,
  system_type TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_folders_parent ON folders(parent_id);
CREATE INDEX idx_folders_owner ON folders(owner_staff_id);

-- =====================================
-- 4. ドキュメント
-- =====================================

CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  staff_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id) NOT NULL,
  is_locked BOOLEAN DEFAULT FALSE,
  min_role_level INT DEFAULT 10,
  source TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documents_folder ON documents(folder_id);
CREATE INDEX idx_documents_staff ON documents(staff_id);

-- =====================================
-- 5. 提出依頼
-- =====================================

CREATE TABLE submission_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  is_required BOOLEAN DEFAULT TRUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'rejected')),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_requests_staff ON submission_requests(staff_id);

-- =====================================
-- 6. スタッフ提出
-- =====================================

CREATE TABLE staff_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID REFERENCES submission_requests(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  review_note TEXT,
  saved_document_id UUID REFERENCES documents(id)
);

CREATE INDEX idx_submissions_staff ON staff_submissions(staff_id);
CREATE INDEX idx_submissions_request ON staff_submissions(request_id);

-- =====================================
-- 7. RLSポリシー（完全版）
-- =====================================

-- ヘルパー関数: ユーザーの権限レベル取得
CREATE OR REPLACE FUNCTION get_user_role_level()
RETURNS INT AS $$
  SELECT COALESCE(
    (SELECT r.level FROM profiles p JOIN roles r ON r.id = p.role_id WHERE p.id = auth.uid()),
    0
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ヘルパー関数: ユーザー名取得
CREATE OR REPLACE FUNCTION get_user_name()
RETURNS TEXT AS $$
  SELECT COALESCE(
    (SELECT name FROM profiles WHERE id = auth.uid()),
    ''
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =====================================
-- roles: 全員読み取りOK（権限マスタなので問題なし）
-- =====================================
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_roles" ON roles FOR SELECT USING (true);

-- =====================================
-- profiles: MG以上は全員見える、スタッフは自分のみ
-- =====================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_profiles" ON profiles FOR SELECT USING (
  get_user_role_level() >= 50  -- MG以上は全員見える
  OR id = auth.uid()           -- 自分は見える
);
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "admin_insert_profiles" ON profiles FOR INSERT WITH CHECK (get_user_role_level() >= 100);
CREATE POLICY "admin_delete_profiles" ON profiles FOR DELETE USING (get_user_role_level() >= 100);

-- =====================================
-- folders: 権限レベルとオーナーでフィルタ
-- =====================================
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_folders" ON folders FOR SELECT USING (
  -- 管理者・MGは権限レベル以下の全フォルダ
  (get_user_role_level() >= 50 AND get_user_role_level() >= min_role_level)
  OR
  -- スタッフは権限レベルをクリアし、オーナーなしか自分がオーナー
  (get_user_role_level() >= min_role_level
   AND (owner_staff_id IS NULL OR owner_staff_id = auth.uid()))
);
CREATE POLICY "admin_insert_folders" ON folders FOR INSERT WITH CHECK (get_user_role_level() >= 100);
CREATE POLICY "admin_update_folders" ON folders FOR UPDATE USING (get_user_role_level() >= 100);
CREATE POLICY "admin_delete_folders" ON folders FOR DELETE USING (get_user_role_level() >= 100);

-- =====================================
-- documents: 権限レベル、鍵マーク、所有者でフィルタ
-- =====================================
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_documents" ON documents FOR SELECT USING (
  -- 管理者は全て見える
  get_user_role_level() >= 100
  OR
  -- MGは権限レベル50以下を見える
  (get_user_role_level() >= 50 AND min_role_level <= 50)
  OR
  -- スタッフは自分の書類のみ（鍵なし）
  (
    get_user_role_level() >= min_role_level
    AND (staff_id = auth.uid() OR staff_name = get_user_name())
    AND is_locked = FALSE
  )
);
CREATE POLICY "admin_insert_documents" ON documents FOR INSERT WITH CHECK (get_user_role_level() >= 100);
CREATE POLICY "admin_update_documents" ON documents FOR UPDATE USING (get_user_role_level() >= 100);
CREATE POLICY "admin_delete_documents" ON documents FOR DELETE USING (get_user_role_level() >= 100);

-- =====================================
-- submission_requests: 自分宛てか全員宛てのみ
-- =====================================
ALTER TABLE submission_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_requests" ON submission_requests FOR SELECT USING (
  -- 管理者は全て
  get_user_role_level() >= 100
  OR
  -- スタッフは自分宛てか全員宛て
  staff_id IS NULL OR staff_id = auth.uid()
);
CREATE POLICY "admin_insert_requests" ON submission_requests FOR INSERT WITH CHECK (get_user_role_level() >= 100);
CREATE POLICY "admin_update_requests" ON submission_requests FOR UPDATE USING (get_user_role_level() >= 100);
CREATE POLICY "admin_delete_requests" ON submission_requests FOR DELETE USING (get_user_role_level() >= 100);

-- =====================================
-- staff_submissions: MG以上は全て、スタッフは自分のみ
-- =====================================
ALTER TABLE staff_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_submissions" ON staff_submissions FOR SELECT USING (
  get_user_role_level() >= 50  -- MG以上は全て
  OR staff_id = auth.uid()      -- 自分の提出物
);
CREATE POLICY "staff_insert_own_submissions" ON staff_submissions FOR INSERT WITH CHECK (staff_id = auth.uid());
CREATE POLICY "admin_update_submissions" ON staff_submissions FOR UPDATE USING (get_user_role_level() >= 50);
CREATE POLICY "admin_delete_submissions" ON staff_submissions FOR DELETE USING (get_user_role_level() >= 100);

-- =====================================
-- 8. Storage バケット
-- =====================================

INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) VALUES ('submissions', 'submissions', false)
ON CONFLICT (id) DO NOTHING;

-- =====================================
-- 9. Storage ポリシー
-- =====================================

-- documents バケット: 管理者アップロード
CREATE POLICY "admins_upload_documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents' AND
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.level >= 100
    )
  );

-- documents バケット: ダウンロード
CREATE POLICY "users_download_documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents' AND
    (
      -- 管理者は全て
      EXISTS (
        SELECT 1 FROM profiles p
        JOIN roles r ON r.id = p.role_id
        WHERE p.id = auth.uid() AND r.level >= 100
      )
      OR
      -- MGは権限レベル50以下
      EXISTS (
        SELECT 1 FROM profiles p
        JOIN roles r ON r.id = p.role_id
        JOIN documents d ON d.file_path = storage.objects.name
        WHERE p.id = auth.uid() AND r.level >= 50 AND d.min_role_level <= 50
      )
      OR
      -- スタッフは自分の書類（鍵なし）
      EXISTS (
        SELECT 1 FROM documents d
        JOIN profiles p ON p.id = auth.uid()
        WHERE d.file_path = storage.objects.name
        AND (d.staff_id = auth.uid() OR d.staff_name = p.name)
        AND d.is_locked = FALSE
      )
    )
  );

-- documents バケット: 管理者削除
CREATE POLICY "admins_delete_documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents' AND
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.level >= 100
    )
  );

-- submissions バケット: スタッフアップロード
CREATE POLICY "staff_upload_submissions" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'submissions' AND
    auth.uid() IS NOT NULL
  );

-- submissions バケット: ダウンロード
CREATE POLICY "users_download_submissions" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'submissions' AND
    (
      -- MG以上は全て
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
-- 10. トリガー・関数
-- =====================================

-- 更新日時自動更新
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 新規ユーザー作成時にプロファイル自動作成
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role_id')::int, 3)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================
-- 11. 初期データ
-- =====================================

-- システムフォルダ「その他」
INSERT INTO folders (name, is_system, system_type, min_role_level)
VALUES ('その他', TRUE, 'unassigned', 50);

-- =====================================
-- 12. 既存ユーザーのプロファイル復元
-- =====================================
-- auth.usersに存在するユーザーのプロファイルを作成

INSERT INTO profiles (id, email, name, role_id)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  COALESCE((u.raw_user_meta_data->>'role_id')::int, 3)
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;

-- =====================================
-- 13. 権限復元
-- =====================================

-- 管理者を設定
UPDATE profiles SET role_id = 1 WHERE email = 'amazontaichi0324@gmail.com';
UPDATE profiles SET role_id = 1 WHERE email = 'belsia.kitao@gmail.com';

-- 名前を復元（user_metadataに無い場合のため）
UPDATE profiles SET name = 'Admin' WHERE email = 'amazontaichi0324@gmail.com';
UPDATE profiles SET name = '北尾夏樹' WHERE email = 'belsia.kitao@gmail.com';
UPDATE profiles SET name = '松本　七帆' WHERE email = '116@staff.internal';
UPDATE profiles SET name = '佐渡　美穂' WHERE email = '96@staff.internal';
UPDATE profiles SET name = '坂本　悠' WHERE email = '134@staff.internal';
UPDATE profiles SET name = '正井　美凪' WHERE email = '118@staff.internal';
UPDATE profiles SET name = '杉原　葉月' WHERE email = '85@staff.internal';
UPDATE profiles SET name = '齋藤　仁識乃' WHERE email = '159@staff.internal';
UPDATE profiles SET name = '金子　愛' WHERE email = '115@staff.internal';
UPDATE profiles SET name = '水本　優子' WHERE email = '99@staff.internal';
UPDATE profiles SET name = '松林　千里子' WHERE email = '172@staff.internal';
UPDATE profiles SET name = '吉住　葵' WHERE email = '174@staff.internal';
UPDATE profiles SET name = '岡本　祥子' WHERE email = '105@staff.internal';
UPDATE profiles SET name = '芦田　涼音' WHERE email = '175@staff.internal';
UPDATE profiles SET name = '村岡　真有' WHERE email = '148@staff.internal';
UPDATE profiles SET name = '鍵(加治)　瑞生' WHERE email = '114@staff.internal';
UPDATE profiles SET name = '島田　明依' WHERE email = '108@staff.internal';
UPDATE profiles SET name = '鍛治　里沙' WHERE email = '107@staff.internal';
UPDATE profiles SET name = '貴島　紗帆' WHERE email = '104@staff.internal';
UPDATE profiles SET name = '田島　静香' WHERE email = '103@staff.internal';
UPDATE profiles SET name = '相賀　果南' WHERE email = '169@staff.internal';
UPDATE profiles SET name = '木村　舞魚' WHERE email = '152@staff.internal';
UPDATE profiles SET name = '柳楽　紗水' WHERE email = '147@staff.internal';
UPDATE profiles SET name = '奥　千尋' WHERE email = '131@staff.internal';
UPDATE profiles SET name = '谷口　綾花' WHERE email = '97@staff.internal';
UPDATE profiles SET name = '瀬山　采加' WHERE email = '161@staff.internal';
UPDATE profiles SET name = '山田　悠紀' WHERE email = '156@staff.internal';
UPDATE profiles SET name = '芹生　玲菜' WHERE email = '141@staff.internal';
UPDATE profiles SET name = '旭　美桜' WHERE email = '139@staff.internal';
UPDATE profiles SET name = '宮崎　ちひろ' WHERE email = '95@staff.internal';
UPDATE profiles SET name = '稲毛(大川)　青空' WHERE email = '94@staff.internal';
UPDATE profiles SET name = '村井　彩乃' WHERE email = '173@staff.internal';
UPDATE profiles SET name = '呉屋　千咲' WHERE email = '160@staff.internal';
UPDATE profiles SET name = '碓井　友貴' WHERE email = '154@staff.internal';
UPDATE profiles SET name = '永田　彩夏' WHERE email = '137@staff.internal';
UPDATE profiles SET name = '近藤　知香' WHERE email = '135@staff.internal';
UPDATE profiles SET name = '長濱　美夏' WHERE email = '55@staff.internal';
UPDATE profiles SET name = '岡田(金尾)　悠加' WHERE email = '56@staff.internal';
UPDATE profiles SET name = '青野(金森)　みのり' WHERE email = '33@staff.internal';
UPDATE profiles SET name = '本田　えり' WHERE email = '119@staff.internal';
UPDATE profiles SET name = '森岡　史野' WHERE email = '111@staff.internal';
UPDATE profiles SET name = '原　久恵' WHERE email = '110@staff.internal';
UPDATE profiles SET name = '向井　妃' WHERE email = '74@staff.internal';
UPDATE profiles SET name = '大西(佐藤)　里佳' WHERE email = '58@staff.internal';
UPDATE profiles SET name = '荒川　佳乃' WHERE email = '164@staff.internal';
UPDATE profiles SET name = '古賀　有華' WHERE email = '179@staff.internal';
UPDATE profiles SET name = '中西　風吹' WHERE email = '165@staff.internal';
UPDATE profiles SET name = '都間　麗' WHERE email = '171@staff.internal';
UPDATE profiles SET name = '岩佐　利胡' WHERE email = '83@staff.internal';
UPDATE profiles SET name = '伊東(科野)　奈津子' WHERE email = '87@staff.internal';
UPDATE profiles SET name = '有馬(坂本)　奈穂' WHERE email = '76@staff.internal';
UPDATE profiles SET name = '川村　ひなた' WHERE email = '157@staff.internal';
UPDATE profiles SET name = '原　奈津希' WHERE email = '84@staff.internal';
UPDATE profiles SET name = '山田　愛実' WHERE email = '77@staff.internal';
UPDATE profiles SET name = '録田　安佳里' WHERE email = '73@staff.internal';
UPDATE profiles SET name = '斉藤　晴香' WHERE email = '132@staff.internal';
UPDATE profiles SET name = '長見　晴香' WHERE email = '109@staff.internal';
UPDATE profiles SET name = '太田　愛蘭' WHERE email = '82@staff.internal';
UPDATE profiles SET name = '仲里　幸花' WHERE email = '59@staff.internal';
UPDATE profiles SET name = '河口　美雪' WHERE email = '38@staff.internal';
UPDATE profiles SET name = '中村　瑠花' WHERE email = '143@staff.internal';
UPDATE profiles SET name = '重盛(森川）　彩歩' WHERE email = '138@staff.internal';
UPDATE profiles SET name = '福田　心雪' WHERE email = '121@staff.internal';
UPDATE profiles SET name = '島岡(金田）　琳央' WHERE email = '7@staff.internal';
UPDATE profiles SET name = '東埜(房野）　萌楓' WHERE email = '44@staff.internal';
UPDATE profiles SET name = '田中　杏梨' WHERE email = '40@staff.internal';
UPDATE profiles SET name = '吉本　安那' WHERE email = '149@staff.internal';
UPDATE profiles SET name = '橋本(荒木）　実咲' WHERE email = '10@staff.internal';
UPDATE profiles SET name = '溝口　愛璃' WHERE email = '162@staff.internal';
UPDATE profiles SET name = '金　宣英' WHERE email = '140@staff.internal';
UPDATE profiles SET name = '北里　佳蓉' WHERE email = '124@staff.internal';
UPDATE profiles SET name = '八幡　真琴' WHERE email = '120@staff.internal';
UPDATE profiles SET name = '鈴木　伊織' WHERE email = '117@staff.internal';
UPDATE profiles SET name = '松下　祐菜' WHERE email = '100@staff.internal';
UPDATE profiles SET name = '小山　瑞季' WHERE email = '81@staff.internal';
UPDATE profiles SET name = '吉山　晴香' WHERE email = '67@staff.internal';
UPDATE profiles SET name = '大住　榛名' WHERE email = '64@staff.internal';
UPDATE profiles SET name = '高原　つばさ' WHERE email = '54@staff.internal';
UPDATE profiles SET name = '三澤(北山)　耀子' WHERE email = '26@staff.internal';
UPDATE profiles SET name = '種田　奈那子' WHERE email = '129@staff.internal';
UPDATE profiles SET name = '須佐美　茜' WHERE email = '150@staff.internal';

-- =====================================
-- 完了
-- =====================================
