'use client'

import { createStockGroup, deleteStockGroup, updateStockGroup } from '@/actions/stocks'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import type { userStockGroups as groupsSchema } from '@/lib/db/schema'
import { cn } from '@/lib/utils'
import { Edit, Folder, FolderOpen, Loader2, MoreVertical, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

interface StockGroupManagerProps {
  groups: Array<typeof groupsSchema.$inferSelect>
  selectedGroupId: string | null | undefined
  onSelectGroup: (groupId: string | null | undefined) => void
  onGroupsChange: () => void
}

export function StockGroupManager({
  groups,
  selectedGroupId,
  onSelectGroup,
  onGroupsChange,
}: StockGroupManagerProps) {
  const t = useTranslations('MyStocks')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [editingGroup, setEditingGroup] = useState<typeof groupsSchema.$inferSelect | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<typeof groupsSchema.$inferSelect | null>(null)
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    if (!groupName.trim()) return

    setLoading(true)
    try {
      const result = await createStockGroup({ name: groupName.trim() })
      if (result.success) {
        toast.success(t('groups.createSuccess'))
        setGroupName('')
        setCreateDialogOpen(false)
        onGroupsChange()
      } else {
        toast.error(t('groups.createError'), {
          description: result.error || 'Unknown error',
        })
      }
    } catch (error) {
      toast.error(t('groups.createError'), {
        description: String(error),
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingGroup || !groupName.trim()) return

    setLoading(true)
    try {
      const result = await updateStockGroup({
        groupId: editingGroup.id,
        name: groupName.trim(),
      })
      if (result.success) {
        toast.success(t('groups.updateSuccess'))
        setEditingGroup(null)
        setGroupName('')
        setEditDialogOpen(false)
        onGroupsChange()
      } else {
        toast.error(t('groups.updateError'), {
          description: result.error || 'Unknown error',
        })
      }
    } catch (error) {
      toast.error(t('groups.updateError'), {
        description: String(error),
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingGroup) return

    setLoading(true)
    try {
      const result = await deleteStockGroup({ groupId: deletingGroup.id })
      if (result.success) {
        toast.success(t('groups.deleteSuccess'))
        setDeletingGroup(null)
        setDeleteDialogOpen(false)
        if (selectedGroupId === deletingGroup.id) {
          onSelectGroup(undefined)
        }
        onGroupsChange()
      } else {
        toast.error(t('groups.deleteError'), {
          description: result.error || 'Unknown error',
        })
      }
    } catch (error) {
      toast.error(t('groups.deleteError'), {
        description: String(error),
      })
    } finally {
      setLoading(false)
    }
  }

  const openEditDialog = (group: typeof groupsSchema.$inferSelect) => {
    setEditingGroup(group)
    setGroupName(group.name)
    setEditDialogOpen(true)
  }

  const openDeleteDialog = (group: typeof groupsSchema.$inferSelect) => {
    setDeletingGroup(group)
    setDeleteDialogOpen(true)
  }

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {/* 全部股票 */}
            <Button
              variant={selectedGroupId === undefined ? 'default' : 'outline'}
              size="sm"
              onClick={() => onSelectGroup(undefined)}
              className="whitespace-nowrap"
            >
              <FolderOpen className="mr-2 h-4 w-4" />
              {t('groups.all')}
            </Button>

            {/* 未分组 */}
            <Button
              variant={selectedGroupId === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => onSelectGroup(null)}
              className="whitespace-nowrap"
            >
              <Folder className="mr-2 h-4 w-4" />
              {t('groups.ungrouped')}
            </Button>

            {/* 用户分组 */}
            {groups.map((group) => (
              <div key={group.id} className="flex items-center gap-1">
                <Button
                  variant={selectedGroupId === group.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onSelectGroup(group.id)}
                  className="whitespace-nowrap"
                >
                  <Folder className="mr-2 h-4 w-4" />
                  {group.name}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEditDialog(group)}>
                      <Edit className="mr-2 h-4 w-4" />
                      {t('groups.rename')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => openDeleteDialog(group)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t('groups.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}

            {/* 添加分组按钮 */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCreateDialogOpen(true)}
              className="whitespace-nowrap ml-2"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('groups.create')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 创建对话框 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('groups.create')}</DialogTitle>
            <DialogDescription>{t('groups.createDescription')}</DialogDescription>
          </DialogHeader>
          <Input
            placeholder={t('groups.namePlaceholder')}
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            maxLength={50}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              {t('groups.cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={loading || !groupName.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('groups.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('groups.rename')}</DialogTitle>
            <DialogDescription>{t('groups.renameDescription')}</DialogDescription>
          </DialogHeader>
          <Input
            placeholder={t('groups.namePlaceholder')}
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
            maxLength={50}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t('groups.cancel')}
            </Button>
            <Button onClick={handleUpdate} disabled={loading || !groupName.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('groups.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('groups.deleteConfirm')}</DialogTitle>
            <DialogDescription>
              {t('groups.deleteDescription', { name: deletingGroup?.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t('groups.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('groups.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
