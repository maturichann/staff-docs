'use client'

import { useState, useCallback, useMemo } from 'react'
import { SubmissionRequest, StaffSubmission } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  Calendar,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

interface SubmissionRequestWithSubmissions extends SubmissionRequest {
  submissions?: StaffSubmission[]
}

interface StaffSubmissionsProps {
  requests: SubmissionRequestWithSubmissions[]
  userId: string
}

export function StaffSubmissions({ requests, userId }: StaffSubmissionsProps) {
  const [uploading, setUploading] = useState<string | null>(null)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const handleUpload = useCallback(async (request: SubmissionRequestWithSubmissions, file: File) => {
    setUploading(request.id)

    try {
      // ファイルパスを生成
      const uuid = crypto.randomUUID()
      const ext = file.name.split('.').pop() || 'pdf'
      const filePath = `${userId}/${uuid}.${ext}`

      // Storageにアップロード
      const { error: uploadError } = await supabase.storage
        .from('submissions')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // DBに記録
      const { error: dbError } = await supabase.from('staff_submissions').insert({
        request_id: request.id,
        staff_id: userId,
        file_path: filePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || 'application/octet-stream',
      })

      if (dbError) throw dbError

      router.refresh()
    } catch (error) {
      console.error('Upload error:', error)
      alert('アップロードに失敗しました')
    } finally {
      setUploading(null)
    }
  }, [supabase, userId, router])

  const getMySubmission = (request: SubmissionRequestWithSubmissions): StaffSubmission | undefined => {
    return request.submissions?.find(s => s.staff_id === userId)
  }

  const getStatusInfo = (request: SubmissionRequestWithSubmissions) => {
    const submission = getMySubmission(request)

    if (!submission) {
      return {
        icon: <Clock className="h-5 w-5 text-amber-500" />,
        badge: <Badge variant="outline">未提出</Badge>,
        canUpload: true,
      }
    }

    if (submission.review_status === 'approved') {
      return {
        icon: <CheckCircle className="h-5 w-5 text-green-500" />,
        badge: <Badge className="bg-green-500">承認済み</Badge>,
        canUpload: false,
      }
    }

    if (submission.review_status === 'rejected') {
      return {
        icon: <XCircle className="h-5 w-5 text-red-500" />,
        badge: <Badge variant="destructive">差し戻し</Badge>,
        canUpload: true,
        note: submission.review_note,
      }
    }

    return {
      icon: <Clock className="h-5 w-5 text-blue-500" />,
      badge: <Badge variant="secondary">確認待ち</Badge>,
      canUpload: false,
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const isOverdue = (dateString: string | null) => {
    if (!dateString) return false
    return new Date(dateString) < new Date()
  }

  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
          <p className="text-lg font-medium">提出が必要な書類はありません</p>
          <p className="text-sm text-muted-foreground">
            新しい依頼があると、ここに表示されます
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {requests.map((request) => {
        const statusInfo = getStatusInfo(request)
        const submission = getMySubmission(request)
        const overdue = isOverdue(request.due_date)

        return (
          <Card key={request.id} className={overdue && statusInfo.canUpload ? 'border-red-200' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {statusInfo.icon}
                  <CardTitle className="text-lg">{request.title}</CardTitle>
                </div>
                {statusInfo.badge}
              </div>
              {request.description && (
                <CardDescription>{request.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {request.due_date && (
                <div className={`flex items-center gap-2 text-sm ${overdue ? 'text-red-600' : 'text-muted-foreground'}`}>
                  <Calendar className="h-4 w-4" />
                  期限: {formatDate(request.due_date)}
                  {overdue && statusInfo.canUpload && (
                    <Badge variant="destructive" className="ml-2">期限切れ</Badge>
                  )}
                </div>
              )}

              {submission && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  提出済み: {submission.file_name}
                </div>
              )}

              {statusInfo.note && (
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-md">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">差し戻し理由:</p>
                    <p>{statusInfo.note}</p>
                  </div>
                </div>
              )}

              {statusInfo.canUpload && (
                <label className="block">
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleUpload(request, file)
                    }}
                    disabled={uploading === request.id}
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={uploading === request.id}
                    asChild
                  >
                    <span>
                      {uploading === request.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          アップロード中...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          {submission ? '再提出' : 'ファイルを選択'}
                        </>
                      )}
                    </span>
                  </Button>
                </label>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
