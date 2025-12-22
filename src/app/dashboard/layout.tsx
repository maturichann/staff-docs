import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardNav } from '@/components/dashboard-nav'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
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

  // プロファイルがない場合はエラー表示（リダイレクトループを防ぐ）
  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow">
          <h1 className="text-xl font-bold text-red-600 mb-2">プロファイルが見つかりません</h1>
          <p className="text-gray-600 mb-4">
            管理者に連絡してアカウントを設定してもらってください。
          </p>
          <p className="text-sm text-gray-500">
            ユーザーID: {user.id}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav profile={profile} />
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
