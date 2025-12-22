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

  const { name, email, password, role } = await request.json()

  if (!name || !email || !password) {
    return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
  }

  try {
    // Service Role Key を使用してユーザーを作成
    const adminClient = createAdminClient()

    const { data: newUser, error: signUpError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: role || 'staff' },
    })

    if (signUpError) {
      console.error('Sign up error:', signUpError)
      return NextResponse.json(
        { error: signUpError.message || 'ユーザーの作成に失敗しました' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true, user: newUser })
  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json(
      { error: 'ユーザーの作成に失敗しました' },
      { status: 500 }
    )
  }
}
