// スタッフ一括登録スクリプト
// 使用方法: npm run seed

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('環境変数が設定されていません')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// スタッフデータ（コード, 名前）
const staffData = [
  ['150', '須佐美　茜'],
  ['116', '松本　七帆'],
  ['96', '佐渡　美穂'],
  ['134', '坂本　悠'],
  ['118', '正井　美凪'],
  ['85', '杉原　葉月'],
  ['159', '齋藤　仁識乃'],
  ['115', '金子　愛'],
  ['99', '水本　優子'],
  ['172', '松林　千里子'],
  ['174', '吉住　葵'],
  ['105', '岡本　祥子'],
  ['175', '芦田　涼音'],
  ['148', '村岡　真有'],
  ['114', '鍵(加治)　瑞生'],
  ['108', '島田　明依'],
  ['107', '鍛治　里沙'],
  ['104', '貴島　紗帆'],
  ['103', '田島　静香'],
  ['169', '相賀　果南'],
  ['152', '木村　舞魚'],
  ['147', '柳楽　紗水'],
  ['131', '奥　千尋'],
  ['97', '谷口　綾花'],
  ['161', '瀬山　采加'],
  ['156', '山田　悠紀'],
  ['141', '芹生　玲菜'],
  ['139', '旭　美桜'],
  ['95', '宮崎　ちひろ'],
  ['94', '稲毛(大川)　青空'],
  ['173', '村井　彩乃'],
  ['160', '呉屋　千咲'],
  ['154', '碓井　友貴'],
  ['137', '永田　彩夏'],
  ['135', '近藤　知香'],
  ['55', '長濱　美夏'],
  ['56', '岡田(金尾)　悠加'],
  ['33', '青野(金森)　みのり'],
  ['119', '本田　えり'],
  ['111', '森岡　史野'],
  ['110', '原　久恵'],
  ['74', '向井　妃'],
  ['58', '大西(佐藤)　里佳'],
  ['164', '荒川　佳乃'],
  ['179', '古賀　有華'],
  ['165', '中西　風吹'],
  ['171', '都間　麗'],
  ['83', '岩佐　利胡'],
  ['87', '伊東(科野)　奈津子'],
  ['76', '有馬(坂本)　奈穂'],
  ['157', '川村　ひなた'],
  ['84', '原　奈津希'],
  ['77', '山田　愛実'],
  ['73', '録田　安佳里'],
  ['132', '斉藤　晴香'],
  ['109', '長見　晴香'],
  ['82', '太田　愛蘭'],
  ['59', '仲里　幸花'],
  ['38', '河口　美雪'],
  ['143', '中村　瑠花'],
  ['138', '重盛(森川）　彩歩'],
  ['121', '福田　心雪'],
  ['7', '島岡(金田）　琳央'],
  ['44', '東埜(房野）　萌楓'],
  ['40', '田中　杏梨'],
  ['10', '橋本(荒木）　実咲'],
  ['162', '溝口　愛璃'],
  ['149', '吉本　安那'],
  ['140', '金　宣英'],
  ['129', '種田　奈那子'],
  ['124', '北里　佳蓉'],
  ['120', '八幡　真琴'],
  ['117', '鈴木　伊織'],
  ['100', '松下　祐菜'],
  ['81', '小山　瑞季'],
  ['67', '吉山　晴香'],
  ['64', '大住　榛名'],
  ['54', '高原　つばさ'],
  ['26', '三澤(北山)　耀子'],
]

// 管理者データ
const adminData = [
  { email: 'belsia.kitao@gmail.com', name: '北尾夏樹' },
  { email: 'amazontaichi0324@gmail.com', name: 'Admin' },
]

async function seedStaff() {
  console.log('スタッフ登録開始...\n')

  let successCount = 0
  let errorCount = 0

  for (const [code, name] of staffData) {
    const email = `${code}@staff.internal`
    const password = `staff${code}` // 初期パスワード: staff + コード

    try {
      // ユーザー作成
      const { data: user, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, role: 'staff', staff_code: code },
      })

      if (createError) {
        if (createError.message.includes('already been registered')) {
          console.log(`⏭️  ${code}: ${name} - 既に登録済み`)
        } else {
          console.error(`❌ ${code}: ${name} - ${createError.message}`)
          errorCount++
        }
        continue
      }

      console.log(`✅ ${code}: ${name}`)
      successCount++
    } catch (err) {
      console.error(`❌ ${code}: ${name} - エラー`)
      errorCount++
    }
  }

  console.log(`\n--- スタッフ登録完了 ---`)
  console.log(`成功: ${successCount}`)
  console.log(`エラー: ${errorCount}`)
}

async function seedAdmins() {
  console.log('\n管理者登録開始...\n')

  for (const admin of adminData) {
    try {
      // 既存ユーザーのプロファイルを更新
      const { data: users } = await supabase.auth.admin.listUsers()
      const existingUser = users.users.find(u => u.email === admin.email)

      if (existingUser) {
        // プロファイルを管理者に更新
        await supabase
          .from('profiles')
          .update({ role: 'admin', name: admin.name })
          .eq('id', existingUser.id)
        console.log(`✅ ${admin.name} (${admin.email}) - 管理者に更新`)
      } else {
        // 新規作成
        const { error } = await supabase.auth.admin.createUser({
          email: admin.email,
          password: 'admin2025',
          email_confirm: true,
          user_metadata: { name: admin.name, role: 'admin' },
        })
        if (error) {
          console.error(`❌ ${admin.name} - ${error.message}`)
        } else {
          console.log(`✅ ${admin.name} (${admin.email}) - 新規作成`)
        }
      }
    } catch (err) {
      console.error(`❌ ${admin.name} - エラー`)
    }
  }
}

async function main() {
  await seedStaff()
  await seedAdmins()
  console.log('\n完了!')
}

main()
