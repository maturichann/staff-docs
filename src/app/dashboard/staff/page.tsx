import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StaffManagement } from '@/components/staff-management'

export default async function StaffPage() {
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

  const { data: staffList } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">スタッフ管理</h1>
        <p className="text-muted-foreground">
          スタッフの追加・編集・削除ができます
        </p>
      </div>

      <StaffManagement staffList={staffList || []} />
    </div>
  )
}
