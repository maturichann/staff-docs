'use client'

import { useState, useCallback } from 'react'
import { FolderTreeNode, ROLE_LEVELS } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Upload,
  FileText,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  Folder,
  FolderOpen,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

interface StaffInfo {
  id: string
  name: string
}

interface FileUploadV2Props {
  staffList: StaffInfo[]
  folders: FolderTreeNode[]
  uploaderId: string
}

interface FileItem {
  file: File
  staffName: string
  staffId: string | null
  folderId: string | null
  relativePath: string | null
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
}

export function FileUploadV2({ staffList, folders, uploaderId }: FileUploadV2Props) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState<string>('auto')
  const router = useRouter()
  const supabase = createClient()

  // 「その他」フォルダのIDを取得
  const unassignedFolder = folders.find(f => f.system_type === 'unassigned')

  // フォルダIDからフォルダを検索（ネスト対応）
  const findFolderById = (folders: FolderTreeNode[], id: string): FolderTreeNode | null => {
    for (const folder of folders) {
      if (folder.id === id) return folder
      const found = findFolderById(folder.children, id)
      if (found) return found
    }
    return null
  }

  const extractStaffName = (fileName: string): { name: string; staffId: string | null } => {
    const match = fileName.match(/^([^_]+)_/)
    const name = match ? match[1] : ''
    const staff = staffList.find((s) => s.name === name)
    return { name, staffId: staff?.id || null }
  }

  const handleFiles = useCallback(
    (newFiles: FileList | File[], relativePaths?: string[]) => {
      const fileArray = Array.from(newFiles)
      const newItems: FileItem[] = fileArray.map((file, index) => {
        const { name, staffId } = extractStaffName(file.name)
        return {
          file,
          staffName: name,
          staffId,
          folderId: selectedFolderId === 'auto' ? null : selectedFolderId === 'none' ? null : selectedFolderId,
          relativePath: relativePaths?.[index] || null,
          status: 'pending',
        }
      })
      setFiles((prev) => [...prev, ...newItems])
    },
    [staffList, selectedFolderId]
  )

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const items = e.dataTransfer.items
      const fileList: File[] = []
      const pathList: string[] = []

      // フォルダをサポート
      const processEntry = async (entry: FileSystemEntry, path: string = ''): Promise<void> => {
        if (entry.isFile) {
          const fileEntry = entry as FileSystemFileEntry
          return new Promise((resolve) => {
            fileEntry.file((file) => {
              fileList.push(file)
              pathList.push(path + file.name)
              resolve()
            })
          })
        } else if (entry.isDirectory) {
          const dirEntry = entry as FileSystemDirectoryEntry
          const reader = dirEntry.createReader()
          return new Promise((resolve) => {
            reader.readEntries(async (entries) => {
              for (const entry of entries) {
                await processEntry(entry, path + dirEntry.name + '/')
              }
              resolve()
            })
          })
        }
      }

      const promises: Promise<void>[] = []
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry()
        if (entry) {
          promises.push(processEntry(entry))
        }
      }

      await Promise.all(promises)

      if (fileList.length > 0) {
        handleFiles(fileList, pathList)
      }
    },
    [handleFiles]
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const uploadFiles = async () => {
    setUploading(true)

    for (let i = 0; i < files.length; i++) {
      const item = files[i]
      if (item.status !== 'pending') continue

      setFiles((prev) =>
        prev.map((f, idx) =>
          idx === i ? { ...f, status: 'uploading' } : f
        )
      )

      try {
        const uuid = crypto.randomUUID()
        const ext = item.file.name.split('.').pop() || 'pdf'
        const filePath = `${uuid}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, item.file)

        if (uploadError) throw uploadError

        // フォルダIDを決定
        let folderId = item.folderId

        // 自動振り分けモードの場合
        if (selectedFolderId === 'auto') {
          if (!item.staffId && unassignedFolder) {
            // スタッフ名がマッチしない場合は「その他」フォルダへ
            folderId = unassignedFolder.id
          }
        }

        // フォルダの権限レベルを継承（フォルダがない場合はスタッフレベル）
        const targetFolder = folderId ? findFolderById(folders, folderId) : null
        const minRoleLevel = targetFolder?.min_role_level ?? ROLE_LEVELS.staff

        const { error: dbError } = await supabase.from('documents').insert({
          file_name: item.file.name,
          file_path: filePath,
          staff_name: item.staffName || '未設定',
          staff_id: item.staffId,
          folder_id: folderId,
          file_size: item.file.size,
          mime_type: item.file.type || 'application/octet-stream',
          uploaded_by: uploaderId,
          source: 'admin',
          min_role_level: minRoleLevel,
        })

        if (dbError) throw dbError

        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: 'success' } : f
          )
        )
      } catch (error) {
        console.error('Upload error:', error)
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i
              ? { ...f, status: 'error', error: 'アップロードに失敗しました' }
              : f
          )
        )
      }
    }

    setUploading(false)
    router.refresh()
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

  const flatFolders = flattenFolders(folders)

  const pendingCount = files.filter((f) => f.status === 'pending').length
  const successCount = files.filter((f) => f.status === 'success').length

  return (
    <div className="space-y-6">
      {/* フォルダ選択 */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium">アップロード先:</label>
        <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                自動振り分け
              </div>
            </SelectItem>
            <SelectItem value="none">
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4" />
                ルート（フォルダなし）
              </div>
            </SelectItem>
            {flatFolders.map(({ folder, depth }) => (
              <SelectItem key={folder.id} value={folder.id}>
                <div className="flex items-center gap-2" style={{ paddingLeft: depth * 12 }}>
                  <Folder className="h-4 w-4" />
                  {folder.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ドロップエリア */}
      <Card
        className={`border-2 border-dashed transition-colors ${
          isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Upload className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-1">
            ファイルまたはフォルダをドラッグ&ドロップ
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            フォルダごとアップロードも可能です
          </p>
          <label>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            <Button variant="outline" asChild>
              <span>ファイルを選択</span>
            </Button>
          </label>
        </CardContent>
      </Card>

      {/* ファイルリスト */}
      {files.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            {files.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{item.file.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {item.staffName ? (
                        <Badge
                          variant={item.staffId ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {item.staffName}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          スタッフ未設定
                        </Badge>
                      )}
                      {!item.staffId && item.staffName && (
                        <span className="text-xs text-amber-600">
                          未登録のスタッフ名
                        </span>
                      )}
                      {item.relativePath && (
                        <span className="text-xs text-muted-foreground">
                          {item.relativePath}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {item.status === 'pending' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  {item.status === 'uploading' && (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  )}
                  {item.status === 'success' && (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                  {item.status === 'error' && (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* アクションボタン */}
      {files.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {pendingCount > 0 && `${pendingCount} 件待機中`}
            {successCount > 0 && ` / ${successCount} 件完了`}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setFiles([])}
              disabled={uploading}
            >
              クリア
            </Button>
            <Button
              onClick={uploadFiles}
              disabled={uploading || pendingCount === 0}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  アップロード中...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  アップロード ({pendingCount})
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* 説明 */}
      <div className="text-sm text-muted-foreground space-y-1">
        <p>• ファイル名の先頭がスタッフ名と一致すると自動で紐付けられます</p>
        <p>• スタッフ名が一致しない書類は「その他」フォルダに振り分けられます</p>
        <p>• フォルダごとドラッグ&ドロップでまとめてアップロードできます</p>
      </div>
    </div>
  )
}
