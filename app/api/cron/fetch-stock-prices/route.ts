/**
 * 股票价格采集 Cron Job (已禁用)
 *
 * 🔴 此定时任务已被禁用
 *
 * 原因: 改用新浪财经接口按需获取实时数据，不再需要定时采集
 *
 * 历史功能:
 * 1. 获取所有被监控的股票列表
 * 2. 调用 Tushare stk_mins 接口获取最新1分钟行情
 * 3. 保存到 stock_price_snapshots 表
 *
 * 新方案:
 * - 用户点击"查看行情"时实时调用新浪接口
 * - 无需提前采集和存储数据
 * - 避免 Tushare API 频率限制问题
 */

import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  console.log('[Cron] fetch-stock-prices is disabled')

  return NextResponse.json({
    success: false,
    disabled: true,
    message: '定时任务已禁用，现改为按需获取实时数据',
    reason: '使用新浪财经接口替代 Tushare，避免频率限制',
    newApproach: '用户点击"查看行情"时实时获取数据',
  })
}
