'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Upload,
  FileText,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

interface StaffInfo {
  id: string
  name: string
}

interface FileUploadProps {
  staffList: StaffInfo[]
  uploaderId: string
}

interface FileItem {
  file: File
  staffName: string
  staffId: string | null
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
}

export function FileUpload({ staffList, uploaderId }: FileUploadProps) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const extractStaffName = (fileName: string): { name: string; staffId: string | null } => {
    // ファイル名の先頭からアンダースコアまでをスタッフ名として抽出
    const match = fileName.match(/^([^_]+)_/)
    const name = match ? match[1] : fileName.replace(/\.[^/.]+$/, '')

    // スタッフリストと照合
    const staff = staffList.find((s) => s.name === name)

    return { name, staffId: staff?.id || null }
  }

  const handleFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles)
      const newItems: FileItem[] = fileArray.map((file) => {
        const { name, staffId } = extractStaffName(file.name)
        return {
          file,
          staffName: name,
          staffId,
          status: 'pending',
        }
      })
      setFiles((prev) => [...prev, ...newItems])
    },
    [staffList]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      handleFiles(e.dataTransfer.files)
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
        // ファイルパスを生成（日本語を避けるためUUID使用）
        const uuid = crypto.randomUUID()
        const ext = item.file.name.split('.').pop() || 'pdf'
        const filePath = `${uuid}.${ext}`

        // Storageにアップロード
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, item.file)

        if (uploadError) throw uploadError

        // DBに記録
        const { error: dbError } = await supabase.from('documents').insert({
          file_name: item.file.name,
          file_path: filePath,
          staff_name: item.staffName,
          staff_id: item.staffId,
          file_size: item.file.size,
          mime_type: item.file.type || 'application/octet-stream',
          uploaded_by: uploaderId,
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

  const pendingCount = files.filter((f) => f.status === 'pending').length
  const successCount = files.filter((f) => f.status === 'success').length

  return (
    <div className="space-y-6">
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
            ファイルをドラッグ&ドロップ
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            または
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
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant={item.staffId ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {item.staffName}
                      </Badge>
                      {!item.staffId && (
                        <span className="text-xs text-amber-600">
                          未登録のスタッフ名
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
    </div>
  )
}
