import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ROLE_LEVELS } from '@/lib/types'
import { SubmissionRequestManager } from '@/components/submission-request-manager'

export default async function RequestsPage() {
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

  // 提出依頼一覧を取得
  const { data: requests } = await supabase
    .from('submission_requests')
    .select(`
      *,
      staff:profiles!submission_requests_staff_id_fkey(id, name, email),
      submissions:staff_submissions(*)
    `)
    .order('created_at', { ascending: false })

  // スタッフ一覧を取得
  const { data: staffList } = await supabase
    .from('profiles')
    .select(`
      *,
      role:roles(*)
    `)
    .order('name')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">提出依頼管理</h1>
        <p className="text-muted-foreground">
          スタッフへの書類提出依頼を管理します
        </p>
      </div>

      <SubmissionRequestManager
        requests={requests || []}
        staffList={staffList || []}
      />
    </div>
  )
}
