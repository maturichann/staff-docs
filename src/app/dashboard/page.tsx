import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DocumentList } from '@/components/document-list'

export default async function DashboardPage() {
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

  if (!profile) {
    redirect('/login')
  }

  // 管理者は全書類、スタッフは自分の書類のみ
  let query = supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false })

  if (profile.role !== 'admin') {
    query = query.eq('staff_name', profile.name)
  }

  const { data: documents } = await query

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {profile.role === 'admin' ? '全書類一覧' : 'あなたの書類'}
        </h1>
        <p className="text-muted-foreground">
          {profile.role === 'admin'
            ? 'アップロードされた全ての書類を管理できます'
            : 'ダウンロード可能な書類が表示されます'}
        </p>
      </div>

      <DocumentList documents={documents || []} isAdmin={profile.role === 'admin'} />
    </div>
  )
}
