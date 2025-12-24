import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FileUploadV2 } from '@/components/file-upload-v2'
import { ROLE_LEVELS } from '@/lib/types'

export default async function UploadPage() {
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

  const roleLevel = profile?.role?.level ?? ROLE_LEVELS.staff

  if (!profile || roleLevel < ROLE_LEVELS.admin) {
    redirect('/dashboard')
  }

  // スタッフ一覧を取得
  const { data: staffList } = await supabase
    .from('profiles')
    .select('id, name')
    .order('name')

  // フォルダ一覧を取得
  const { data: folders } = await supabase
    .from('folders')
    .select('*')
    .order('name')

  // フォルダをツリー構造に変換
  const buildFolderTree = (folders: any[], parentId: string | null = null): any[] => {
    return folders
      .filter(f => f.parent_id === parentId)
      .map(folder => ({
        ...folder,
        children: buildFolderTree(folders, folder.id),
      }))
  }

  const folderTree = buildFolderTree(folders || [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">書類アップロード</h1>
        <p className="text-muted-foreground">
          ファイル名の先頭にスタッフ名を付けると自動で振り分けられます（例: 山田太郎_給与明細.pdf）
        </p>
      </div>

      <FileUploadV2
        staffList={staffList || []}
        folders={folderTree}
        uploaderId={user.id}
      />
    </div>
  )
}
