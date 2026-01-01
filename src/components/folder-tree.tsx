'use client'

import { useState } from 'react'
import { Folder, FolderTreeNode, ROLE_LEVELS } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ChevronRight,
  ChevronDown,
  Folder as FolderIcon,
  FolderOpen,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Lock,
  Users,
  User,
  Loader2,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface StaffInfo {
  id: string
  name: string
}

interface FolderTreeProps {
  folders: FolderTreeNode[]
  selectedFolderId: string | null
  onSelectFolder: (folderId: string | null) => void
  userRoleLevel: number
  isAdmin: boolean
  staffList: StaffInfo[]
}

export function FolderTree({
  folders,
  selectedFolderId,
  onSelectFolder,
  userRoleLevel,
  isAdmin,
  staffList,
}: FolderTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [newFolderDialog, setNewFolderDialog] = useState<{ open: boolean; parentId: string | null }>({
    open: false,
    parentId: null,
  })
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderRoleLevel, setNewFolderRoleLevel] = useState<number>(ROLE_LEVELS.staff)
  const [newFolderOwner, setNewFolderOwner] = useState<string>('')
  const [editDialog, setEditDialog] = useState<{ open: boolean; folder: Folder | null }>({
    open: false,
    folder: null,
  })
  const [editName, setEditName] = useState('')
  const [editRoleLevel, setEditRoleLevel] = useState<number>(ROLE_LEVELS.staff)
  const [editOwner, setEditOwner] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const toggleExpand = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    setLoading(true)

    try {
      const { error } = await supabase.from('folders').insert({
        name: newFolderName.trim(),
        parent_id: newFolderDialog.parentId,
        min_role_level: newFolderRoleLevel,
        owner_staff_id: newFolderOwner || null,
      })

      if (error) throw error

      setNewFolderDialog({ open: false, parentId: null })
      setNewFolderName('')
      setNewFolderRoleLevel(ROLE_LEVELS.staff)
      setNewFolderOwner('')
      router.refresh()
    } catch (error) {
      console.error('Create folder error:', error)
      alert('フォルダの作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleRenameFolder = async () => {
    if (!editDialog.folder || !editName.trim()) return
    setLoading(true)

    try {
      const { error } = await supabase
        .from('folders')
        .update({
          name: editName.trim(),
          min_role_level: editRoleLevel,
          owner_staff_id: editOwner || null,
        })
        .eq('id', editDialog.folder.id)

      if (error) throw error

      setEditDialog({ open: false, folder: null })
      setEditName('')
      setEditRoleLevel(ROLE_LEVELS.staff)
      setEditOwner('')
      router.refresh()
    } catch (error) {
      console.error('Rename folder error:', error)
      alert('フォルダ名の変更に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteFolder = async (folder: Folder) => {
    if (folder.is_system) {
      alert('システムフォルダは削除できません')
      return
    }

    if (!confirm(`「${folder.name}」を削除しますか？中のファイルも削除されます。`)) return

    try {
      const { error } = await supabase.from('folders').delete().eq('id', folder.id)

      if (error) throw error

      if (selectedFolderId === folder.id) {
        onSelectFolder(null)
      }
      router.refresh()
    } catch (error) {
      console.error('Delete folder error:', error)
      alert('フォルダの削除に失敗しました')
    }
  }

  const getRoleLevelIcon = (level: number) => {
    if (level >= ROLE_LEVELS.admin) return <Lock className="h-3 w-3 text-red-500" />
    if (level >= ROLE_LEVELS.mg) return <Users className="h-3 w-3 text-orange-500" />
    return null
  }

  const renderFolder = (folder: FolderTreeNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(folder.id)
    const isSelected = selectedFolderId === folder.id
    const hasChildren = folder.children && folder.children.length > 0

    return (
      <div key={folder.id}>
        <div
          className={cn(
            'flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer hover:bg-muted/50 group',
            isSelected && 'bg-primary/10 text-primary'
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {/* 展開ボタン */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (hasChildren) toggleExpand(folder.id)
            }}
            className="p-0.5"
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )
            ) : (
              <span className="w-4" />
            )}
          </button>

          {/* フォルダアイコン */}
          <button
            onClick={() => onSelectFolder(folder.id)}
            className="flex items-center gap-2 flex-1 min-w-0"
          >
            {isExpanded ? (
              <FolderOpen className="h-4 w-4 text-amber-500 shrink-0" />
            ) : (
              <FolderIcon className="h-4 w-4 text-amber-500 shrink-0" />
            )}
            <span className="truncate text-sm">{folder.name}</span>
            {folder.owner_staff_id && <User className="h-3 w-3 text-blue-500" />}
            {getRoleLevelIcon(folder.min_role_level)}
            {folder.document_count !== undefined && folder.document_count > 0 && (
              <span className="text-xs text-muted-foreground">({folder.document_count})</span>
            )}
          </button>

          {/* メニュー */}
          {isAdmin && !folder.is_system && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setNewFolderDialog({ open: true, parentId: folder.id })}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  サブフォルダ作成
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setEditDialog({ open: true, folder })
                    setEditName(folder.name)
                    setEditRoleLevel(folder.min_role_level)
                    setEditOwner(folder.owner_staff_id || '')
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  編集
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleDeleteFolder(folder)}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  削除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* 子フォルダ */}
        {isExpanded && hasChildren && (
          <div>
            {folder.children.map((child) => renderFolder(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* ルートフォルダ（すべて） */}
      <div
        className={cn(
          'flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer hover:bg-muted/50',
          selectedFolderId === null && 'bg-primary/10 text-primary'
        )}
        onClick={() => onSelectFolder(null)}
      >
        <FolderIcon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">すべての書類</span>
      </div>

      {/* フォルダツリー */}
      {folders.map((folder) => renderFolder(folder))}

      {/* 新規フォルダボタン */}
      {isAdmin && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={() => setNewFolderDialog({ open: true, parentId: null })}
        >
          <Plus className="h-4 w-4" />
          新規フォルダ
        </Button>
      )}

      {/* 新規フォルダダイアログ */}
      <Dialog
        open={newFolderDialog.open}
        onOpenChange={(open) => {
          setNewFolderDialog({ open, parentId: null })
          if (!open) {
            setNewFolderName('')
            setNewFolderRoleLevel(ROLE_LEVELS.staff)
            setNewFolderOwner('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新規フォルダ作成</DialogTitle>
            <DialogDescription>
              フォルダ名と閲覧権限を設定してください
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>フォルダ名</Label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="フォルダ名"
              />
            </div>
            <div className="space-y-2">
              <Label>閲覧権限</Label>
              <Select
                value={String(newFolderRoleLevel)}
                onValueChange={(v) => setNewFolderRoleLevel(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={String(ROLE_LEVELS.staff)}>全員（スタッフ以上）</SelectItem>
                  <SelectItem value={String(ROLE_LEVELS.mg)}>MG以上</SelectItem>
                  <SelectItem value={String(ROLE_LEVELS.admin)}>管理者のみ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>オーナー（個人フォルダ用）</Label>
              <Select
                value={newFolderOwner}
                onValueChange={setNewFolderOwner}
              >
                <SelectTrigger>
                  <SelectValue placeholder="なし（共有フォルダ）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">なし（共有フォルダ）</SelectItem>
                  {staffList.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                オーナーを設定すると、そのスタッフと管理者のみ表示されます
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewFolderDialog({ open: false, parentId: null })}
            >
              キャンセル
            </Button>
            <Button onClick={handleCreateFolder} disabled={loading || !newFolderName.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '作成'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* フォルダ編集ダイアログ */}
      <Dialog
        open={editDialog.open}
        onOpenChange={(open) => {
          setEditDialog({ open, folder: null })
          if (!open) {
            setEditName('')
            setEditRoleLevel(ROLE_LEVELS.staff)
            setEditOwner('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>フォルダを編集</DialogTitle>
            <DialogDescription>
              フォルダ名と閲覧権限を変更できます
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>フォルダ名</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="フォルダ名"
              />
            </div>
            <div className="space-y-2">
              <Label>閲覧権限</Label>
              <Select
                value={String(editRoleLevel)}
                onValueChange={(v) => setEditRoleLevel(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={String(ROLE_LEVELS.staff)}>全員（スタッフ以上）</SelectItem>
                  <SelectItem value={String(ROLE_LEVELS.mg)}>MG以上</SelectItem>
                  <SelectItem value={String(ROLE_LEVELS.admin)}>管理者のみ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>オーナー（個人フォルダ用）</Label>
              <Select
                value={editOwner}
                onValueChange={setEditOwner}
              >
                <SelectTrigger>
                  <SelectValue placeholder="なし（共有フォルダ）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">なし（共有フォルダ）</SelectItem>
                  {staffList.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                オーナーを設定すると、そのスタッフと管理者のみ表示されます
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialog({ open: false, folder: null })}
            >
              キャンセル
            </Button>
            <Button onClick={handleRenameFolder} disabled={loading || !editName.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
