import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FileUpload } from '@/components/file-upload'

export default async function UploadPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    redirect('/dashboard')
  }

  // スタッフ一覧を取得（名前のマッチング確認用）
  const { data: staffList } = await supabase
    .from('profiles')
    .select('id, name')
    .order('name')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">書類アップロード</h1>
        <p className="text-muted-foreground">
          ファイル名の先頭にスタッフ名を付けてください（例: 山田太郎_給与明細_2025年1月.pdf）
        </p>
      </div>

      <FileUpload staffList={staffList || []} uploaderId={user.id} />
    </div>
  )
}
