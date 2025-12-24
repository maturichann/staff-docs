'use client'

import { useState, useMemo } from 'react'
import { Document, FolderTreeNode, ROLE_LEVELS, canViewDocument, filterFoldersByPermission } from '@/lib/types'
import { FolderTree } from './folder-tree'
import { DocumentListV2 } from './document-list-v2'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  FolderOpen,
  ChevronRight,
  Home,
  Upload,
} from 'lucide-react'
import Link from 'next/link'

interface FolderBrowserProps {
  folders: FolderTreeNode[]
  documents: Document[]
  userRoleLevel: number
  userId: string
  userName: string
  isAdmin: boolean
}

export function FolderBrowser({
  folders,
  documents,
  userRoleLevel,
  userId,
  userName,
  isAdmin,
}: FolderBrowserProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // 権限でフィルタしたフォルダ
  const filteredFolders = useMemo(
    () => filterFoldersByPermission(folders, userRoleLevel),
    [folders, userRoleLevel]
  )

  // 選択中のフォルダを取得
  const findFolder = (folders: FolderTreeNode[], id: string): FolderTreeNode | null => {
    for (const folder of folders) {
      if (folder.id === id) return folder
      const found = findFolder(folder.children, id)
      if (found) return found
    }
    return null
  }

  const selectedFolder = selectedFolderId ? findFolder(filteredFolders, selectedFolderId) : null

  // パンくずリストを構築
  const buildBreadcrumbs = (
    folders: FolderTreeNode[],
    targetId: string,
    path: FolderTreeNode[] = []
  ): FolderTreeNode[] | null => {
    for (const folder of folders) {
      if (folder.id === targetId) {
        return [...path, folder]
      }
      const found = buildBreadcrumbs(folder.children, targetId, [...path, folder])
      if (found) return found
    }
    return null
  }

  const breadcrumbs = selectedFolderId ? buildBreadcrumbs(filteredFolders, selectedFolderId) : null

  // フィルタされたドキュメント
  const filteredDocuments = useMemo(() => {
    let docs = documents

    // 閲覧権限フィルタ
    docs = docs.filter(doc => canViewDocument(userRoleLevel, userId, doc))

    // フォルダフィルタ
    if (selectedFolderId) {
      docs = docs.filter(doc => doc.folder_id === selectedFolderId)
    }

    // スタッフは自分の書類のみ
    if (userRoleLevel < ROLE_LEVELS.mg) {
      docs = docs.filter(doc => doc.staff_name === userName || doc.staff_id === userId)
    }

    // 検索フィルタ
    if (search) {
      const searchLower = search.toLowerCase()
      docs = docs.filter(
        doc =>
          doc.file_name.toLowerCase().includes(searchLower) ||
          doc.staff_name.toLowerCase().includes(searchLower)
      )
    }

    return docs
  }, [documents, selectedFolderId, search, userRoleLevel, userId, userName])

  return (
    <div className="flex gap-6">
      {/* サイドバー */}
      <div className="w-64 shrink-0">
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              フォルダ
            </CardTitle>
          </CardHeader>
          <CardContent className="py-0 pb-4">
            <FolderTree
              folders={filteredFolders}
              selectedFolderId={selectedFolderId}
              onSelectFolder={setSelectedFolderId}
              userRoleLevel={userRoleLevel}
              isAdmin={isAdmin}
            />
          </CardContent>
        </Card>

        {/* クイックアクション */}
        {isAdmin && (
          <Card className="mt-4">
            <CardContent className="py-4 space-y-2">
              <Link href="/dashboard/upload">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Upload className="h-4 w-4 mr-2" />
                  アップロード
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {/* メインエリア */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* パンくずリスト */}
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => setSelectedFolderId(null)}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <Home className="h-4 w-4" />
            すべて
          </button>
          {breadcrumbs?.map((folder, index) => (
            <span key={folder.id} className="flex items-center gap-2">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <button
                onClick={() => setSelectedFolderId(folder.id)}
                className={
                  index === breadcrumbs.length - 1
                    ? 'font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }
              >
                {folder.name}
              </button>
            </span>
          ))}
        </div>

        {/* ヘッダー */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              {selectedFolder?.name || 'すべての書類'}
            </h1>
            <p className="text-muted-foreground text-sm">
              {filteredDocuments.length} 件の書類
              {selectedFolder?.min_role_level && selectedFolder.min_role_level >= ROLE_LEVELS.mg && (
                <Badge variant="secondary" className="ml-2">
                  {selectedFolder.min_role_level >= ROLE_LEVELS.admin ? '管理者限定' : 'MG以上'}
                </Badge>
              )}
            </p>
          </div>

          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* ドキュメントリスト */}
        <DocumentListV2
          documents={filteredDocuments}
          folders={folders}
          isAdmin={isAdmin}
          userRoleLevel={userRoleLevel}
          currentFolderId={selectedFolderId}
        />
      </div>
    </div>
  )
}
