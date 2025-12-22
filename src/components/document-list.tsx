'use client'

import { useState, useMemo } from 'react'
import { Document } from '@/lib/types'
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
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Download,
  FileText,
  Trash2,
  Search,
  Loader2,
  FolderOpen,
  Pencil,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

interface DocumentListProps {
  documents: Document[]
  isAdmin: boolean
}

export function DocumentList({ documents, isAdmin }: DocumentListProps) {
  const [search, setSearch] = useState('')
  const [downloading, setDownloading] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editingDoc, setEditingDoc] = useState<Document | null>(null)
  const [editStaffName, setEditStaffName] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const filteredDocuments = documents.filter(
    (doc) =>
      doc.file_name.toLowerCase().includes(search.toLowerCase()) ||
      doc.staff_name.toLowerCase().includes(search.toLowerCase())
  )

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
      // ストレージから削除
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([doc.file_path])

      if (storageError) throw storageError

      // DBから削除
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
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="ファイル名またはスタッフ名で検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

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
            {filteredDocuments.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{doc.file_name}</span>
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(doc)}
                        disabled={deleting === doc.id}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        {deleting === doc.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <p className="text-sm text-muted-foreground text-center">
        {filteredDocuments.length} 件の書類
      </p>

      {/* 編集ダイアログ */}
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
    </div>
  )
}
