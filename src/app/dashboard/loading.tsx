import { Card, CardContent, CardHeader } from '@/components/ui/card'

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />
}

export default function DashboardLoading() {
  return (
    <div className="flex gap-6">
      {/* サイドバー */}
      <div className="w-64 shrink-0">
        <Card>
          <CardHeader className="py-4">
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent className="py-0 pb-4 space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-2/3" />
          </CardContent>
        </Card>
      </div>

      {/* メインエリア */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* パンくず */}
        <Skeleton className="h-5 w-32" />

        {/* ヘッダー */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-9 w-64" />
        </div>

        {/* テーブル */}
        <Card>
          <CardContent className="p-0">
            <div className="border-b p-4">
              <div className="flex gap-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
            {[...Array(8)].map((_, i) => (
              <div key={i} className="border-b p-4 last:border-0">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-20 ml-auto" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
