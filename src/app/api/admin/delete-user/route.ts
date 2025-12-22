import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  // 現在のユーザーが管理者か確認
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
  }

  const { userId } = await request.json()

  if (!userId) {
    return NextResponse.json({ error: 'ユーザーIDが必要です' }, { status: 400 })
  }

  // 自分自身は削除できない
  if (userId === user.id) {
    return NextResponse.json({ error: '自分自身は削除できません' }, { status: 400 })
  }

  try {
    // Service Role Key を使用してユーザーを削除
    const adminClient = createAdminClient()

    const { error } = await adminClient.auth.admin.deleteUser(userId)

    if (error) {
      console.error('Delete user error:', error)
      return NextResponse.json(
        { error: error.message || 'ユーザーの削除に失敗しました' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json(
      { error: 'ユーザーの削除に失敗しました' },
      { status: 500 }
    )
  }
}
