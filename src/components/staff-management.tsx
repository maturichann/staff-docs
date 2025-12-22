'use client'

import { useState, useMemo } from 'react'
import { Profile } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { UserPlus, Trash2, Loader2, Users, Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface StaffManagementProps {
  staffList: Profile[]
}

export function StaffManagement({ staffList }: StaffManagementProps) {
  const [open, setOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Profile | null>(null)
  const [name, setName] = useState('')
  const [staffCode, setStaffCode] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'staff'>('staff')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const resetForm = () => {
    setName('')
    setStaffCode('')
    setEmail('')
    setPassword('')
    setRole('staff')
    setError(null)
  }

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const userEmail = role === 'staff'
      ? `${staffCode}@staff.internal`
      : email

    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email: userEmail,
          password,
          role,
          staffCode: role === 'staff' ? staffCode : undefined
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'ユーザーの作成に失敗しました')
      }

      setOpen(false)
      resetForm()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (staff: Profile) => {
    setEditingStaff(staff)
    setName(staff.name)
    setRole(staff.role as 'admin' | 'staff')
    setEditOpen(true)
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingStaff) return

    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ name, role })
        .eq('id', editingStaff.id)

      if (error) throw error

      setEditOpen(false)
      setEditingStaff(null)
      resetForm()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (staff: Profile) => {
    if (!confirm(`「${staff.name}」を削除しますか？この操作は取り消せません。`)) {
      return
    }

    setDeleting(staff.id)
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: staff.id }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '削除に失敗しました')
      }

      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : '削除に失敗しました')
    } finally {
      setDeleting(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getStaffCode = (email: string) => {
    if (email.endsWith('@staff.internal')) {
      return email.replace('@staff.internal', '')
    }
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              スタッフを追加
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新しいスタッフを追加</DialogTitle>
              <DialogDescription>
                スタッフのアカウント情報を入力してください
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddStaff}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>役割</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="role"
                        value="staff"
                        checked={role === 'staff'}
                        onChange={() => setRole('staff')}
                      />
                      スタッフ
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="role"
                        value="admin"
                        checked={role === 'admin'}
                        onChange={() => setRole('admin')}
                      />
                      管理者
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">名前</Label>
                  <Input
                    id="name"
                    placeholder="山田　太郎"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    書類ファイル名の先頭と一致させてください
                  </p>
                </div>

                {role === 'staff' ? (
                  <div className="space-y-2">
                    <Label htmlFor="staffCode">スタッフコード</Label>
                    <Input
                      id="staffCode"
                      type="text"
                      placeholder="例: 180"
                      value={staffCode}
                      onChange={(e) => setStaffCode(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      ログイン時に使用するコードです
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="email">メールアドレス</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="yamada@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="password">パスワード</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                    {error}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  キャンセル
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      作成中...
                    </>
                  ) : (
                    '追加'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* 編集ダイアログ */}
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) { setEditingStaff(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>スタッフを編集</DialogTitle>
            <DialogDescription>
              スタッフ情報を変更できます
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEdit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editName">名前</Label>
                <Input
                  id="editName"
                  placeholder="山田　太郎"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  書類ファイル名の先頭と一致させてください
                </p>
              </div>

              <div className="space-y-2">
                <Label>役割</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="editRole"
                      value="staff"
                      checked={role === 'staff'}
                      onChange={() => setRole('staff')}
                    />
                    スタッフ
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="editRole"
                      value="admin"
                      checked={role === 'admin'}
                      onChange={() => setRole('admin')}
                    />
                    管理者
                  </label>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                  {error}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                キャンセル
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  '保存'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {staffList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">スタッフがいません</p>
            <p className="text-sm text-muted-foreground">
              「スタッフを追加」ボタンから追加してください
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>スタッフ</TableHead>
                <TableHead>コード/メール</TableHead>
                <TableHead>役割</TableHead>
                <TableHead>登録日</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffList.map((staff) => {
                const code = getStaffCode(staff.email)
                return (
                  <TableRow key={staff.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {getInitials(staff.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{staff.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {code ? (
                        <Badge variant="outline">{code}</Badge>
                      ) : (
                        staff.email
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={staff.role === 'admin' ? 'default' : 'secondary'}>
                        {staff.role === 'admin' ? '管理者' : 'スタッフ'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(staff.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(staff)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(staff)}
                          disabled={deleting === staff.id}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          {deleting === staff.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <p className="text-sm text-muted-foreground text-center">
        {staffList.length} 名のスタッフ
      </p>
    </div>
  )
}
