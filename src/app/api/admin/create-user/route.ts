import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { ROLE_LEVELS } from '@/lib/types'

export async function POST(request: Request) {
  const supabase = await createClient()

  // 現在のユーザーが管理者か確認
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      *,
      role:roles(*)
    `)
    .eq('id', user.id)
    .single()

  const roleLevel = profile?.role?.level ?? 0

  if (!profile || roleLevel < ROLE_LEVELS.admin) {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
  }

  const { name, email, password, role_id } = await request.json()

  if (!name || !email || !password || !role_id) {
    return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
  }

  try {
    const adminClient = createAdminClient()

    // ユーザーを作成
    const { data: newUser, error: signUpError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role_id },
    })

    if (signUpError) {
      console.error('Sign up error:', signUpError)
      return NextResponse.json(
        { error: signUpError.message || 'ユーザーの作成に失敗しました' },
        { status: 400 }
      )
    }

    // プロファイルを更新（role_idを設定）
    if (newUser.user) {
      const { error: updateError } = await adminClient
        .from('profiles')
        .update({ role_id })
        .eq('id', newUser.user.id)

      if (updateError) {
        console.error('Profile update error:', updateError)
      }
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
