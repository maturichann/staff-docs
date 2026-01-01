// =====================================
// 権限システム
// =====================================

export type RoleName = 'admin' | 'mg' | 'staff'

export interface Role {
  id: number
  name: RoleName
  label: string
  level: number
  created_at: string
}

// =====================================
// プロファイル
// =====================================

export interface Profile {
  id: string
  email: string
  name: string
  role_id: number
  role?: Role
  created_at: string
  updated_at: string
}

// 権限チェック用ヘルパー
export const ROLE_LEVELS = {
  admin: 100,
  mg: 50,
  staff: 10,
} as const

// =====================================
// フォルダ
// =====================================

export interface Folder {
  id: string
  name: string
  parent_id: string | null
  owner_staff_id: string | null
  min_role_level: number
  is_system: boolean
  system_type: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // リレーション
  children?: Folder[]
  documents?: Document[]
  owner?: Profile
}

// =====================================
// ドキュメント
// =====================================

export interface Document {
  id: string
  file_name: string
  file_path: string
  staff_name: string
  staff_id: string | null
  folder_id: string | null
  file_size: number
  mime_type: string
  uploaded_by: string
  is_locked: boolean
  min_role_level: number
  source: 'admin' | 'staff'
  created_at: string
  // リレーション
  folder?: Folder
  staff?: Profile
}

// =====================================
// 提出書類システム
// =====================================

export type SubmissionStatus = 'pending' | 'submitted' | 'approved' | 'rejected'
export type ReviewStatus = 'pending' | 'approved' | 'rejected'

export interface SubmissionRequest {
  id: string
  staff_id: string | null
  title: string
  description: string | null
  due_date: string | null
  is_required: boolean
  status: SubmissionStatus
  created_by: string | null
  created_at: string
  // リレーション
  staff?: Profile
  submissions?: StaffSubmission[]
}

export interface StaffSubmission {
  id: string
  request_id: string
  staff_id: string
  file_path: string
  file_name: string
  file_size: number
  mime_type: string
  submitted_at: string
  reviewed_by: string | null
  reviewed_at: string | null
  review_status: ReviewStatus
  review_note: string | null
  saved_document_id: string | null
  // リレーション
  request?: SubmissionRequest
  staff?: Profile
  reviewer?: Profile
}

// =====================================
// ヘルパー型
// =====================================

export interface Staff {
  id: string
  name: string
  email: string
  role_id: number
  role?: Role
  created_at: string
}

// フォルダツリー用
export interface FolderTreeNode extends Folder {
  children: FolderTreeNode[]
  document_count?: number
}

// 権限チェック
export function hasPermission(userRoleLevel: number, requiredLevel: number): boolean {
  return userRoleLevel >= requiredLevel
}

export function canViewDocument(
  userRoleLevel: number,
  userId: string,
  doc: Document
): boolean {
  // 管理者は全て見れる
  if (userRoleLevel >= ROLE_LEVELS.admin) return true

  // ドキュメント自体の権限レベルチェック
  if (userRoleLevel < doc.min_role_level) return false

  // フォルダの権限レベルチェック（フォルダがある場合）
  if (doc.folder && userRoleLevel < doc.folder.min_role_level) return false

  // 鍵マークの書類は本人には見せない
  if (doc.is_locked && doc.staff_id === userId) return false

  // MGは権限レベル以下の書類を見れる
  if (userRoleLevel >= ROLE_LEVELS.mg) return true

  // スタッフは自分の書類のみ
  return doc.staff_id === userId
}

// フォルダの閲覧権限チェック
export function canViewFolder(
  userRoleLevel: number,
  userId: string,
  folder: Folder | FolderTreeNode
): boolean {
  // 管理者・MGは全フォルダ見える
  if (userRoleLevel >= ROLE_LEVELS.mg) {
    return userRoleLevel >= folder.min_role_level
  }

  // スタッフの場合：
  // 1. min_role_level をクリア
  // 2. owner_staff_id がない OR 自分が owner
  if (userRoleLevel < folder.min_role_level) return false
  if (folder.owner_staff_id && folder.owner_staff_id !== userId) return false

  return true
}

// フォルダツリーを権限でフィルタ
export function filterFoldersByPermission(
  folders: FolderTreeNode[],
  userRoleLevel: number,
  userId: string
): FolderTreeNode[] {
  return folders
    .filter(folder => canViewFolder(userRoleLevel, userId, folder))
    .map(folder => ({
      ...folder,
      children: filterFoldersByPermission(folder.children, userRoleLevel, userId)
    }))
}
