'use server'

import { actionResponse, ActionResult } from '@/lib/action-response'
import { getSession } from '@/lib/auth/server'
import { db } from '@/lib/db'
import {
  userStockGroups as groupsSchema,
  userWatchedStocks as watchedStocksSchema,
} from '@/lib/db/schema'
import { getErrorMessage } from '@/lib/error-utils'
import { and, eq, desc, ne } from 'drizzle-orm'
import { z } from 'zod'

const CreateGroupSchema = z.object({
  name: z.string().min(1).max(50),
})

const UpdateGroupSchema = z.object({
  groupId: z.string().uuid(),
  name: z.string().min(1).max(50),
})

const DeleteGroupSchema = z.object({
  groupId: z.string().uuid(),
})

const MoveStockToGroupSchema = z.object({
  stockId: z.string().uuid(),
  groupId: z.string().uuid().nullable(),
})

export type CreateGroupResult = ActionResult<{
  group: typeof groupsSchema.$inferSelect
}>

export type UpdateGroupResult = ActionResult<{
  group: typeof groupsSchema.$inferSelect
}>

export type DeleteGroupResult = ActionResult<{
  success: boolean
}>

export type MoveStockToGroupResult = ActionResult<{
  success: boolean
}>

export type GetGroupsResult = ActionResult<{
  groups: Array<typeof groupsSchema.$inferSelect>
}>

/**
 * 创建分组
 */
export async function createStockGroup(
  params: z.infer<typeof CreateGroupSchema>
): Promise<CreateGroupResult> {
  const session = await getSession()
  const user = session?.user
  if (!user) {
    return actionResponse.unauthorized()
  }

  try {
    const { name } = CreateGroupSchema.parse(params)

    // 检查是否已存在同名分组
    const existing = await db
      .select()
      .from(groupsSchema)
      .where(and(eq(groupsSchema.userId, user.id), eq(groupsSchema.name, name)))
      .limit(1)
      .execute()

    if (existing && existing.length > 0) {
      return actionResponse.error('Group name already exists')
    }

    // 获取当前用户最大 sortOrder
    const maxSortOrder = await db
      .select()
      .from(groupsSchema)
      .where(eq(groupsSchema.userId, user.id))
      .orderBy(desc(groupsSchema.sortOrder))
      .limit(1)
      .execute()

    const nextSortOrder = maxSortOrder.length > 0 ? (maxSortOrder[0].sortOrder || 0) + 1 : 1

    const result = await db
      .insert(groupsSchema)
      .values({
        userId: user.id,
        name,
        sortOrder: nextSortOrder,
      })
      .returning()
      .execute()

    return actionResponse.success({ group: result[0] })
  } catch (error) {
    console.error('[CreateStockGroup] Error:', error)
    return actionResponse.error(getErrorMessage(error))
  }
}

/**
 * 更新分组名称
 */
export async function updateStockGroup(
  params: z.infer<typeof UpdateGroupSchema>
): Promise<UpdateGroupResult> {
  const session = await getSession()
  const user = session?.user
  if (!user) {
    return actionResponse.unauthorized()
  }

  try {
    const { groupId, name } = UpdateGroupSchema.parse(params)

    // 检查分组是否属于当前用户
    const group = await db
      .select()
      .from(groupsSchema)
      .where(and(eq(groupsSchema.id, groupId), eq(groupsSchema.userId, user.id)))
      .limit(1)
      .execute()

    if (!group || group.length === 0) {
      return actionResponse.error('Group not found')
    }

    // 检查新名称是否与其他分组冲突
    const existing = await db
      .select()
      .from(groupsSchema)
      .where(
        and(
          eq(groupsSchema.userId, user.id),
          eq(groupsSchema.name, name),
          // 排除当前分组
          ne(groupsSchema.id, groupId)
        )
      )
      .limit(1)
      .execute()

    if (existing && existing.length > 0) {
      return actionResponse.error('Group name already exists')
    }

    const result = await db
      .update(groupsSchema)
      .set({ name })
      .where(and(eq(groupsSchema.id, groupId), eq(groupsSchema.userId, user.id)))
      .returning()
      .execute()

    return actionResponse.success({ group: result[0] })
  } catch (error) {
    console.error('[UpdateStockGroup] Error:', error)
    return actionResponse.error(getErrorMessage(error))
  }
}

/**
 * 删除分组
 * 注意:删除分组后,该分组下的股票将变为未分组状态(groupId = null)
 */
export async function deleteStockGroup(
  params: z.infer<typeof DeleteGroupSchema>
): Promise<DeleteGroupResult> {
  const session = await getSession()
  const user = session?.user
  if (!user) {
    return actionResponse.unauthorized()
  }

  try {
    const { groupId } = DeleteGroupSchema.parse(params)

    // 检查分组是否属于当前用户
    const group = await db
      .select()
      .from(groupsSchema)
      .where(and(eq(groupsSchema.id, groupId), eq(groupsSchema.userId, user.id)))
      .limit(1)
      .execute()

    if (!group || group.length === 0) {
      return actionResponse.error('Group not found')
    }

    // 删除分组(数据库约束会自动将关联股票的 groupId 设为 null)
    await db
      .delete(groupsSchema)
      .where(and(eq(groupsSchema.id, groupId), eq(groupsSchema.userId, user.id)))
      .execute()

    return actionResponse.success({ success: true })
  } catch (error) {
    console.error('[DeleteStockGroup] Error:', error)
    return actionResponse.error(getErrorMessage(error))
  }
}

/**
 * 移动股票到指定分组
 */
export async function moveStockToGroup(
  params: z.infer<typeof MoveStockToGroupSchema>
): Promise<MoveStockToGroupResult> {
  const session = await getSession()
  const user = session?.user
  if (!user) {
    return actionResponse.unauthorized()
  }

  try {
    const { stockId, groupId } = MoveStockToGroupSchema.parse(params)

    // 如果 groupId 不为 null,检查分组是否存在且属于当前用户
    if (groupId) {
      const group = await db
        .select()
        .from(groupsSchema)
        .where(and(eq(groupsSchema.id, groupId), eq(groupsSchema.userId, user.id)))
        .limit(1)
        .execute()

      if (!group || group.length === 0) {
        return actionResponse.error('Group not found')
      }
    }

    // 更新股票的分组
    await db
      .update(watchedStocksSchema)
      .set({ groupId })
      .where(
        and(eq(watchedStocksSchema.userId, user.id), eq(watchedStocksSchema.stockId, stockId))
      )
      .execute()

    return actionResponse.success({ success: true })
  } catch (error) {
    console.error('[MoveStockToGroup] Error:', error)
    return actionResponse.error(getErrorMessage(error))
  }
}

/**
 * 获取用户所有分组
 */
export async function getUserStockGroups(): Promise<GetGroupsResult> {
  const session = await getSession()
  const user = session?.user
  if (!user) {
    return actionResponse.unauthorized()
  }

  try {
    const groups = await db
      .select()
      .from(groupsSchema)
      .where(eq(groupsSchema.userId, user.id))
      .orderBy(groupsSchema.sortOrder)
      .execute()

    return actionResponse.success({ groups })
  } catch (error) {
    console.error('[GetUserStockGroups] Error:', error)
    return actionResponse.error(getErrorMessage(error))
  }
}
