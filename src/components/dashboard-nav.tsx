'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Profile, ROLE_LEVELS } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FileText, LogOut, Users, Upload, FolderOpen, FileUp } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

interface DashboardNavProps {
  profile: Profile
  roleLevel: number
}

export function DashboardNav({ profile, roleLevel }: DashboardNavProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = profile.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const isAdmin = roleLevel >= ROLE_LEVELS.admin
  const isMG = roleLevel >= ROLE_LEVELS.mg

  const getRoleLabel = () => {
    if (isAdmin) return '管理者'
    if (isMG) return 'マネージャー'
    return 'スタッフ'
  }

  const getRoleBadgeVariant = () => {
    if (isAdmin) return 'default'
    if (isMG) return 'secondary'
    return 'outline'
  }

  return (
    <nav className="border-b bg-white">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              <span className="font-semibold text-lg">Staff Docs</span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <FolderOpen className="h-4 w-4 mr-2" />
                  書類一覧
                </Button>
              </Link>
              {isAdmin && (
                <Link href="/dashboard/upload">
                  <Button variant="ghost" size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    アップロード
                  </Button>
                </Link>
              )}
              {!isAdmin && (
                <Link href="/dashboard/submissions">
                  <Button variant="ghost" size="sm">
                    <FileUp className="h-4 w-4 mr-2" />
                    提出書類
                  </Button>
                </Link>
              )}
              {isMG && (
                <Link href="/dashboard/staff">
                  <Button variant="ghost" size="sm">
                    <Users className="h-4 w-4 mr-2" />
                    スタッフ管理
                  </Button>
                </Link>
              )}
              {isAdmin && (
                <Link href="/dashboard/requests">
                  <Button variant="ghost" size="sm">
                    <FileUp className="h-4 w-4 mr-2" />
                    提出依頼
                  </Button>
                </Link>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{profile.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {profile.email}
                  </p>
                  <Badge variant={getRoleBadgeVariant() as "default" | "secondary" | "outline"} className="w-fit mt-1">
                    {getRoleLabel()}
                  </Badge>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="md:hidden">
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">
                    <FolderOpen className="h-4 w-4 mr-2" />
                    書類一覧
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/upload">
                      <Upload className="h-4 w-4 mr-2" />
                      アップロード
                    </Link>
                  </DropdownMenuItem>
                )}
                {!isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/submissions">
                      <FileUp className="h-4 w-4 mr-2" />
                      提出書類
                    </Link>
                  </DropdownMenuItem>
                )}
                {isMG && (
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/staff">
                      <Users className="h-4 w-4 mr-2" />
                      スタッフ管理
                    </Link>
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/requests">
                      <FileUp className="h-4 w-4 mr-2" />
                      提出依頼
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
              </div>
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                ログアウト
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  )
}
