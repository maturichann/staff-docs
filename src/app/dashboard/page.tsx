import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ROLE_LEVELS } from '@/lib/types'
import { FolderBrowser } from '@/components/folder-browser'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      *,
      role:roles(*)
    `)
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  const roleLevel = profile.role?.level ?? ROLE_LEVELS.staff
  const isAdmin = roleLevel >= ROLE_LEVELS.admin

  // フォルダ一覧を取得（必要カラムのみ）
  const { data: folders } = await supabase
    .from('folders')
    .select('id, name, parent_id, owner_staff_id, min_role_level, is_system, system_type')
    .order('name')

  // ドキュメント一覧を取得（フォルダ情報も含める）
  const { data: documents } = await supabase
    .from('documents')
    .select(`
      *,
      folder:folders(*)
    `)
    .order('created_at', { ascending: false })

  // スタッフ一覧を取得（フォルダオーナー選択用）
  const { data: staffList } = await supabase
    .from('profiles')
    .select('id, name')
    .order('name')

  // フォルダをツリー構造に変換
  const buildFolderTree = (folders: any[], parentId: string | null = null): any[] => {
    return folders
      .filter(f => f.parent_id === parentId)
      .map(folder => ({
        ...folder,
        children: buildFolderTree(folders, folder.id),
        document_count: documents?.filter(d => d.folder_id === folder.id).length || 0,
      }))
  }

  const folderTree = buildFolderTree(folders || [])

  return (
    <FolderBrowser
      folders={folderTree}
      documents={documents || []}
      userRoleLevel={roleLevel}
      userId={user.id}
      userName={profile.name}
      isAdmin={isAdmin}
      staffList={staffList || []}
    />
  )
}
