'use client'

import { useState, useMemo } from 'react'
import { SubmissionRequest, Profile, StaffSubmission } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Plus,
  Loader2,
  FileUp,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Trash2,
  Download,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

interface SubmissionRequestWithRelations extends Omit<SubmissionRequest, 'staff'> {
  staff?: Profile | null
  submissions?: StaffSubmission[]
}

interface SubmissionRequestManagerProps {
  requests: SubmissionRequestWithRelations[]
  staffList: Profile[]
}

export function SubmissionRequestManager({
  requests,
  staffList,
}: SubmissionRequestManagerProps) {
  const [open, setOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<SubmissionRequestWithRelations | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [staffId, setStaffId] = useState<string>('all')
  const [dueDate, setDueDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [reviewNote, setReviewNote] = useState('')
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setStaffId('all')
    setDueDate('')
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setLoading(true)
    try {
      const { error } = await supabase.from('submission_requests').insert({
        title: title.trim(),
        description: description.trim() || null,
        staff_id: staffId === 'all' ? null : staffId,
        due_date: dueDate || null,
      })

      if (error) throw error

      setOpen(false)
      resetForm()
      router.refresh()
    } catch (error) {
      console.error('Create error:', error)
      alert('依頼の作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (request: SubmissionRequestWithRelations) => {
    if (!confirm(`「${request.title}」の依頼を削除しますか？`)) return

    try {
      const { error } = await supabase
        .from('submission_requests')
        .delete()
        .eq('id', request.id)

      if (error) throw error
      router.refresh()
    } catch (error) {
      console.error('Delete error:', error)
      alert('削除に失敗しました')
    }
  }

  const handleReview = async (submission: StaffSubmission, status: 'approved' | 'rejected') => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('staff_submissions')
        .update({
          review_status: status,
          review_note: reviewNote || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', submission.id)

      if (error) throw error

      setReviewOpen(false)
      setSelectedRequest(null)
      setReviewNote('')
      router.refresh()
    } catch (error) {
      console.error('Review error:', error)
      alert('レビューに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (submission: StaffSubmission) => {
    try {
      const { data, error } = await supabase.storage
        .from('submissions')
        .download(submission.file_path)

      if (error) throw error

      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = submission.file_name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Download error:', error)
      alert('ダウンロードに失敗しました')
    }
  }

  const getStatusBadge = (request: SubmissionRequestWithRelations) => {
    const submissions = request.submissions || []
    const approved = submissions.filter(s => s.review_status === 'approved').length
    const pending = submissions.filter(s => s.review_status === 'pending').length

    if (approved > 0 && pending === 0) {
      return <Badge className="bg-green-500">承認済み</Badge>
    }
    if (pending > 0) {
      return <Badge variant="secondary">確認待ち ({pending})</Badge>
    }
    return <Badge variant="outline">未提出</Badge>
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新規依頼
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>提出依頼を作成</DialogTitle>
              <DialogDescription>
                スタッフに書類の提出を依頼します
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">書類名 *</Label>
                  <Input
                    id="title"
                    placeholder="例: 年金手帳、運転免許証"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">説明</Label>
                  <Textarea
                    id="description"
                    placeholder="提出にあたっての注意事項など"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>対象スタッフ</Label>
                  <Select value={staffId} onValueChange={setStaffId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全員</SelectItem>
                      {staffList.map((staff) => (
                        <SelectItem key={staff.id} value={staff.id}>
                          {staff.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dueDate">提出期限</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  キャンセル
                </Button>
                <Button type="submit" disabled={loading || !title.trim()}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '作成'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileUp className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">提出依頼がありません</p>
            <p className="text-sm text-muted-foreground">
              「新規依頼」から作成してください
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>書類名</TableHead>
                <TableHead>対象</TableHead>
                <TableHead>期限</TableHead>
                <TableHead>状態</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium">{request.title}</span>
                      {request.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-xs">
                          {request.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {request.staff ? (
                      <Badge variant="outline">{request.staff.name}</Badge>
                    ) : (
                      <Badge variant="secondary">全員</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(request.due_date)}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(request)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {request.submissions && request.submissions.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedRequest(request)
                            setReviewOpen(true)
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(request)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* 提出確認ダイアログ */}
      <Dialog open={reviewOpen} onOpenChange={(o) => { setReviewOpen(o); if (!o) setSelectedRequest(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedRequest?.title} - 提出確認</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedRequest?.submissions?.map((submission) => (
              <Card key={submission.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{submission.file_name}</p>
                      <p className="text-sm text-muted-foreground">
                        提出日: {formatDate(submission.submitted_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(submission)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {submission.review_status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleReview(submission, 'approved')}
                            disabled={loading}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            承認
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleReview(submission, 'rejected')}
                            disabled={loading}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            差し戻し
                          </Button>
                        </>
                      )}
                      {submission.review_status === 'approved' && (
                        <Badge className="bg-green-500">承認済み</Badge>
                      )}
                      {submission.review_status === 'rejected' && (
                        <Badge variant="destructive">差し戻し</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {selectedRequest?.submissions?.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                まだ提出がありません
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
