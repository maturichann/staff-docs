import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StaffSubmissions } from '@/components/staff-submissions'

export default async function SubmissionsPage() {
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

  // 自分宛ての依頼を取得（全員向け or 自分宛て）
  const { data: requests } = await supabase
    .from('submission_requests')
    .select(`
      *,
      submissions:staff_submissions(*)
    `)
    .or(`staff_id.is.null,staff_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">提出書類</h1>
        <p className="text-muted-foreground">
          提出が必要な書類を確認・アップロードできます
        </p>
      </div>

      <StaffSubmissions
        requests={requests || []}
        userId={user.id}
      />
    </div>
  )
}
