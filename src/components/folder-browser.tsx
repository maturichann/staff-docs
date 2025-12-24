'use client'

import { useState, useMemo, useCallback } from 'react'
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

// 検索用に小文字化したドキュメント
interface SearchableDocument extends Document {
  _fileNameLower: string
  _staffNameLower: string
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

  // id -> folder マップを事前構築（O(1)検索）
  const folderMap = useMemo(() => {
    const map = new Map<string, FolderTreeNode>()
    const buildMap = (folders: FolderTreeNode[]) => {
      for (const folder of folders) {
        map.set(folder.id, folder)
        buildMap(folder.children)
      }
    }
    buildMap(filteredFolders)
    return map
  }, [filteredFolders])

  // id -> 親チェーン マップを事前構築（パンくず用）
  const parentChainMap = useMemo(() => {
    const map = new Map<string, FolderTreeNode[]>()
    const buildChain = (folders: FolderTreeNode[], chain: FolderTreeNode[] = []) => {
      for (const folder of folders) {
        const newChain = [...chain, folder]
        map.set(folder.id, newChain)
        buildChain(folder.children, newChain)
      }
    }
    buildChain(filteredFolders)
    return map
  }, [filteredFolders])

  // O(1)でフォルダ取得
  const selectedFolder = selectedFolderId ? folderMap.get(selectedFolderId) ?? null : null

  // O(1)でパンくず取得
  const breadcrumbs = selectedFolderId ? parentChainMap.get(selectedFolderId) ?? null : null

  // 検索用に前処理したドキュメント
  const searchableDocuments = useMemo<SearchableDocument[]>(() => {
    return documents.map(doc => ({
      ...doc,
      _fileNameLower: doc.file_name.toLowerCase(),
      _staffNameLower: doc.staff_name.toLowerCase(),
    }))
  }, [documents])

  // フィルタされたドキュメント
  const filteredDocuments = useMemo(() => {
    let docs = searchableDocuments

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

    // 検索フィルタ（前処理済みの小文字を使用）
    if (search) {
      const searchLower = search.toLowerCase()
      docs = docs.filter(
        doc =>
          doc._fileNameLower.includes(searchLower) ||
          doc._staffNameLower.includes(searchLower)
      )
    }

    return docs
  }, [searchableDocuments, selectedFolderId, search, userRoleLevel, userId, userName])

  // フォルダ選択ハンドラをメモ化
  const handleSelectFolder = useCallback((folderId: string | null) => {
    setSelectedFolderId(folderId)
  }, [])

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
              onSelectFolder={handleSelectFolder}
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
            onClick={() => handleSelectFolder(null)}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <Home className="h-4 w-4" />
            すべて
          </button>
          {breadcrumbs?.map((folder, index) => (
            <span key={folder.id} className="flex items-center gap-2">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <button
                onClick={() => handleSelectFolder(folder.id)}
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
