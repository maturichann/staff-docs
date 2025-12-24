'use client'

import { useState, useMemo, useCallback, useRef, memo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Document, FolderTreeNode, ROLE_LEVELS } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Download,
  FileText,
  Trash2,
  Loader2,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Lock,
  Unlock,
  FolderInput,
  Shield,
  Eye,
  EyeOff,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

interface DocumentListV2Props {
  documents: Document[]
  folders: FolderTreeNode[]
  isAdmin: boolean
  userRoleLevel: number
  currentFolderId: string | null
}

export function DocumentListV2({
  documents,
  folders,
  isAdmin,
  userRoleLevel,
  currentFolderId,
}: DocumentListV2Props) {
  const [downloading, setDownloading] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editingDoc, setEditingDoc] = useState<Document | null>(null)
  const [editStaffName, setEditStaffName] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const handleDownload = async (doc: Document) => {
    setDownloading(doc.id)
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(doc.file_path)

      if (error) throw error

      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.file_name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Download error:', error)
      alert('ダウンロードに失敗しました')
    } finally {
      setDownloading(null)
    }
  }

  const handleDelete = async (doc: Document) => {
    if (!confirm(`「${doc.file_name}」を削除しますか？`)) return

    setDeleting(doc.id)
    try {
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([doc.file_path])

      if (storageError) throw storageError

      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id)

      if (dbError) throw dbError

      router.refresh()
    } catch (error) {
      console.error('Delete error:', error)
      alert('削除に失敗しました')
    } finally {
      setDeleting(null)
    }
  }

  const handleToggleLock = async (doc: Document) => {
    try {
      const { error } = await supabase
        .from('documents')
        .update({ is_locked: !doc.is_locked })
        .eq('id', doc.id)

      if (error) throw error
      router.refresh()
    } catch (error) {
      console.error('Toggle lock error:', error)
      alert('更新に失敗しました')
    }
  }

  // フォルダIDからフォルダを検索（ネスト対応）
  const findFolderById = useCallback((folders: FolderTreeNode[], id: string): FolderTreeNode | null => {
    for (const folder of folders) {
      if (folder.id === id) return folder
      const found = findFolderById(folder.children, id)
      if (found) return found
    }
    return null
  }, [])

  const handleMoveToFolder = async (doc: Document, folderId: string | null) => {
    try {
      // 移動先フォルダの権限レベルを継承
      const targetFolder = folderId ? findFolderById(folders, folderId) : null
      const minRoleLevel = targetFolder?.min_role_level ?? ROLE_LEVELS.staff

      const { error } = await supabase
        .from('documents')
        .update({
          folder_id: folderId,
          min_role_level: minRoleLevel
        })
        .eq('id', doc.id)

      if (error) throw error
      router.refresh()
    } catch (error) {
      console.error('Move error:', error)
      alert('移動に失敗しました')
    }
  }

  const handleChangeRoleLevel = async (doc: Document, level: number) => {
    try {
      const { error } = await supabase
        .from('documents')
        .update({ min_role_level: level })
        .eq('id', doc.id)

      if (error) throw error
      router.refresh()
    } catch (error) {
      console.error('Change role level error:', error)
      alert('更新に失敗しました')
    }
  }

  const handleEdit = (doc: Document) => {
    setEditingDoc(doc)
    setEditStaffName(doc.staff_name)
  }

  const handleSaveEdit = async () => {
    if (!editingDoc || !editStaffName.trim()) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('documents')
        .update({ staff_name: editStaffName.trim() })
        .eq('id', editingDoc.id)

      if (error) throw error

      setEditingDoc(null)
      router.refresh()
    } catch (error) {
      console.error('Update error:', error)
      alert('更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getRoleLevelBadge = (level: number) => {
    if (level >= ROLE_LEVELS.admin) {
      return <Badge variant="destructive" className="text-xs">管理者のみ</Badge>
    }
    if (level >= ROLE_LEVELS.mg) {
      return <Badge variant="secondary" className="text-xs">MG以上</Badge>
    }
    return null
  }

  // フォルダ一覧をフラット化
  const flattenFolders = (folders: FolderTreeNode[], depth = 0): { folder: FolderTreeNode; depth: number }[] => {
    const result: { folder: FolderTreeNode; depth: number }[] = []
    for (const folder of folders) {
      result.push({ folder, depth })
      result.push(...flattenFolders(folder.children, depth + 1))
    }
    return result
  }

  const flatFolders = useMemo(() => flattenFolders(folders), [folders])

  // バーチャルスクロール用
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: documents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56, // 行の高さ
    overscan: 5,
  })

  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">書類がありません</p>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? 'アップロードページから書類を追加してください'
              : '管理者がアップロードするとここに表示されます'}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ファイル名</TableHead>
              <TableHead>スタッフ</TableHead>
              <TableHead>サイズ</TableHead>
              <TableHead>アップロード日</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{doc.file_name}</span>
                    {doc.is_locked && (
                      <span title="本人非表示">
                        <Lock className="h-3 w-3 text-red-500" />
                      </span>
                    )}
                    {getRoleLevelBadge(doc.min_role_level)}
                    {doc.source === 'staff' && (
                      <Badge variant="outline" className="text-xs">提出</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {isAdmin ? (
                    <button
                      onClick={() => handleEdit(doc)}
                      className="inline-flex items-center gap-1 hover:opacity-70 transition-opacity"
                    >
                      <Badge variant="outline">{doc.staff_name}</Badge>
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                  ) : (
                    <Badge variant="outline">{doc.staff_name}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatFileSize(doc.file_size)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(doc.created_at)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(doc)}
                      disabled={downloading === doc.id}
                    >
                      {downloading === doc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </Button>

                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(doc)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            スタッフ名編集
                          </DropdownMenuItem>

                          <DropdownMenuItem onClick={() => handleToggleLock(doc)}>
                            {doc.is_locked ? (
                              <>
                                <Unlock className="h-4 w-4 mr-2" />
                                本人に表示
                              </>
                            ) : (
                              <>
                                <EyeOff className="h-4 w-4 mr-2" />
                                本人非表示（鍵）
                              </>
                            )}
                          </DropdownMenuItem>

                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <FolderInput className="h-4 w-4 mr-2" />
                              フォルダ移動
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              <DropdownMenuItem onClick={() => handleMoveToFolder(doc, null)}>
                                <FolderOpen className="h-4 w-4 mr-2" />
                                ルート（フォルダなし）
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {flatFolders.map(({ folder, depth }) => (
                                <DropdownMenuItem
                                  key={folder.id}
                                  onClick={() => handleMoveToFolder(doc, folder.id)}
                                  style={{ paddingLeft: `${depth * 12 + 8}px` }}
                                >
                                  <FolderOpen className="h-4 w-4 mr-2" />
                                  {folder.name}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>

                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <Shield className="h-4 w-4 mr-2" />
                              閲覧権限
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              <DropdownMenuItem onClick={() => handleChangeRoleLevel(doc, ROLE_LEVELS.staff)}>
                                <Eye className="h-4 w-4 mr-2" />
                                全員
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleChangeRoleLevel(doc, ROLE_LEVELS.mg)}>
                                <Eye className="h-4 w-4 mr-2" />
                                MG以上
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleChangeRoleLevel(doc, ROLE_LEVELS.admin)}>
                                <Lock className="h-4 w-4 mr-2" />
                                管理者のみ
                              </DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>

                          <DropdownMenuSeparator />

                          <DropdownMenuItem
                            onClick={() => handleDelete(doc)}
                            className="text-red-600"
                            disabled={deleting === doc.id}
                          >
                            {deleting === doc.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 mr-2" />
                            )}
                            削除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* スタッフ名編集ダイアログ */}
      <Dialog open={!!editingDoc} onOpenChange={() => setEditingDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>スタッフ名を編集</DialogTitle>
            <DialogDescription>
              {editingDoc?.file_name} のスタッフ名を変更します
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="staffName">スタッフ名</Label>
            <Input
              id="staffName"
              value={editStaffName}
              onChange={(e) => setEditStaffName(e.target.value)}
              placeholder="スタッフ名を入力"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDoc(null)}>
              キャンセル
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving || !editStaffName.trim()}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                '保存'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
