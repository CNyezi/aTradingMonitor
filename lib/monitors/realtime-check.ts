/**
 * 前端实时监控规则检查 - 状态转换模式
 * 基于 WebSocket 推送的实时行情数据进行规则匹配
 * 支持告警状态管理和自动关闭
 */

import type { RealtimeQuote } from '@/lib/websocket/types'
import type { MonitorRuleConfig } from './check-rules'
import type { AlertCheckResult, AlertState, RealtimeAlertData } from './types'
import type { TimeWindowManager } from './time-window-manager'

/**
 * 检查价格涨跌幅监控
 * 支持状态转换: 超过阈值打开告警,回落到95%以下关闭告警
 */
export function checkRealtimePriceChange(
  quote: RealtimeQuote,
  _previousQuote: RealtimeQuote | undefined,
  config: MonitorRuleConfig,
  currentAlertState?: AlertState
): AlertCheckResult {
  const threshold = config.priceChangeThreshold || 5 // 默认5%
  const changePercent = parseFloat(String(quote.changePercent || 0))
  const absChangePercent = Math.abs(changePercent)

  // 如果当前有活跃告警,检查是否应该关闭
  if (currentAlertState && currentAlertState.status !== 'CLOSED') {
    // 关闭条件: 涨跌幅回落到阈值的95%以下
    const closeThreshold = threshold * 0.95

    if (absChangePercent < closeThreshold) {
      return {
        shouldOpen: false,
        shouldClose: true,
      }
    }

    // 继续保持告警状态
    return {
      shouldOpen: false,
      shouldClose: false,
    }
  }

  // 如果没有活跃告警,检查是否应该打开
  if (absChangePercent >= threshold) {
    const alertData: RealtimeAlertData = {
      stockCode: quote.tsCode,
      alertType: 'price_change',
      message: `${quote.tsCode} 涨跌幅 ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}% 超过阈值 ${threshold}%`,
      currentPrice: quote.currentPrice,
      changePercent,
      triggerTime: new Date(),
      triggerData: {
        threshold,
        changePercent,
        currentPrice: quote.currentPrice,
        open: quote.open,
      },
    }

    return {
      shouldOpen: true,
      shouldClose: false,
      alertData,
    }
  }

  // 不满足任何条件
  return {
    shouldOpen: false,
    shouldClose: false,
  }
}

/**
 * 检查成交量异动监控
 * 使用 TimeWindowManager 计算增量和平均值
 * 支持状态转换: 超过倍数打开告警,回落到阈值95%以下关闭告警
 */
export function checkRealtimeVolumeSpike(
  quote: RealtimeQuote,
  config: MonitorRuleConfig,
  currentAlertState?: AlertState,
  timeWindowManager?: TimeWindowManager
): AlertCheckResult {
  // 如果没有时间窗口管理器,无法检查
  if (!timeWindowManager) {
    return {
      shouldOpen: false,
      shouldClose: false,
    }
  }

  const multiplier = config.volumeMultiplier || 2 // 默认2倍
  const volumePeriod = config.volumePeriod || 5 // 默认5分钟

  // 获取当前1秒的成交量增量
  const currentIncrement = timeWindowManager.getVolumeIncrement(quote.tsCode)

  // 获取前N分钟的平均成交量增量
  const avgIncrement = timeWindowManager.getAverageVolumeIncrement(quote.tsCode, volumePeriod)

  // 如果平均增量为0,无法计算比率
  if (avgIncrement === 0) {
    return {
      shouldOpen: false,
      shouldClose: false,
    }
  }

  const volumeRatio = currentIncrement / avgIncrement

  // 如果当前有活跃告警,检查是否应该关闭
  if (currentAlertState && currentAlertState.status !== 'CLOSED') {
    // 关闭条件: 成交量比率回落到倍数的95%以下
    const closeThreshold = multiplier * 0.95

    if (volumeRatio < closeThreshold) {
      return {
        shouldOpen: false,
        shouldClose: true,
      }
    }

    // 继续保持告警状态
    return {
      shouldOpen: false,
      shouldClose: false,
    }
  }

  // 如果没有活跃告警,检查是否应该打开
  if (volumeRatio >= multiplier) {
    const alertData: RealtimeAlertData = {
      stockCode: quote.tsCode,
      alertType: 'volume_spike',
      message: `${quote.tsCode} 成交量激增 ${volumeRatio.toFixed(2)}倍 (${volumePeriod}分钟均值)`,
      currentPrice: quote.currentPrice,
      changePercent: parseFloat(String(quote.changePercent || 0)),
      triggerTime: new Date(),
      triggerData: {
        currentIncrement,
        avgIncrement,
        volumeRatio,
        multiplier,
        volumePeriod,
      },
    }

    return {
      shouldOpen: true,
      shouldClose: false,
      alertData,
    }
  }

  // 不满足任何条件
  return {
    shouldOpen: false,
    shouldClose: false,
  }
}

/**
 * 检查涨停监控
 * A股涨停阈值通常为10% (创业板/科创板为20%)
 * 支持状态转换: 接近涨停打开告警,回落到阈值95%以下关闭告警
 */
export function checkRealtimeLimitUp(
  quote: RealtimeQuote,
  previousQuote: RealtimeQuote | undefined,
  config: MonitorRuleConfig,
  currentAlertState?: AlertState
): AlertCheckResult {
  const threshold = config.limitThreshold || 10 // 默认10%
  const changePercent = parseFloat(String(quote.changePercent || 0))
  const limitThreshold = threshold * 0.99 // 9.9%以上视为涨停

  // 如果当前有活跃告警,检查是否应该关闭
  if (currentAlertState && currentAlertState.status !== 'CLOSED') {
    // 关闭条件: 涨幅回落到涨停阈值的95%以下
    const closeThreshold = limitThreshold * 0.95

    if (changePercent < closeThreshold) {
      return {
        shouldOpen: false,
        shouldClose: true,
      }
    }

    // 继续保持告警状态
    return {
      shouldOpen: false,
      shouldClose: false,
    }
  }

  // 如果没有活跃告警,检查是否应该打开
  if (changePercent >= limitThreshold) {
    const alertData: RealtimeAlertData = {
      stockCode: quote.tsCode,
      alertType: 'limit_up',
      message: `${quote.tsCode} 涨停！涨幅 ${changePercent.toFixed(2)}%`,
      currentPrice: quote.currentPrice,
      changePercent,
      triggerTime: new Date(),
      triggerData: {
        threshold,
        changePercent,
        currentPrice: quote.currentPrice,
        limitThreshold,
      },
    }

    return {
      shouldOpen: true,
      shouldClose: false,
      alertData,
    }
  }

  // 不满足任何条件
  return {
    shouldOpen: false,
    shouldClose: false,
  }
}

/**
 * 检查跌停监控
 * 支持状态转换: 接近跌停打开告警,回升到阈值95%以上关闭告警
 */
export function checkRealtimeLimitDown(
  quote: RealtimeQuote,
  previousQuote: RealtimeQuote | undefined,
  config: MonitorRuleConfig,
  currentAlertState?: AlertState
): AlertCheckResult {
  const threshold = config.limitThreshold || 10 // 默认10%
  const changePercent = parseFloat(String(quote.changePercent || 0))
  const limitThreshold = -threshold * 0.99 // -9.9%以下视为跌停

  // 如果当前有活跃告警,检查是否应该关闭
  if (currentAlertState && currentAlertState.status !== 'CLOSED') {
    // 关闭条件: 跌幅回升到跌停阈值的95%以上
    const closeThreshold = limitThreshold * 0.95 // 注意是负值,所以是*0.95

    if (changePercent > closeThreshold) {
      return {
        shouldOpen: false,
        shouldClose: true,
      }
    }

    // 继续保持告警状态
    return {
      shouldOpen: false,
      shouldClose: false,
    }
  }

  // 如果没有活跃告警,检查是否应该打开
  if (changePercent <= limitThreshold) {
    const alertData: RealtimeAlertData = {
      stockCode: quote.tsCode,
      alertType: 'limit_down',
      message: `${quote.tsCode} 跌停！跌幅 ${changePercent.toFixed(2)}%`,
      currentPrice: quote.currentPrice,
      changePercent,
      triggerTime: new Date(),
      triggerData: {
        threshold,
        changePercent,
        currentPrice: quote.currentPrice,
        limitThreshold,
      },
    }

    return {
      shouldOpen: true,
      shouldClose: false,
      alertData,
    }
  }

  // 不满足任何条件
  return {
    shouldOpen: false,
    shouldClose: false,
  }
}

/**
 * 检查价格突破监控
 * 支持状态转换: 突破触发打开告警,回退到突破价的另一侧关闭告警
 */
export function checkRealtimePriceBreakout(
  quote: RealtimeQuote,
  previousQuote: RealtimeQuote | undefined,
  config: MonitorRuleConfig,
  currentAlertState?: AlertState
): AlertCheckResult {
  const { breakoutPrice, breakoutDirection } = config

  if (!breakoutPrice || !breakoutDirection) {
    return {
      shouldOpen: false,
      shouldClose: false,
    }
  }

  const currentPrice = quote.currentPrice

  // 如果当前有活跃告警,检查是否应该关闭
  if (currentAlertState && currentAlertState.status !== 'CLOSED') {
    const direction = currentAlertState.triggerData.triggerData.breakoutDirection

    // 向上突破的关闭条件: 价格回落到突破价以下
    if (direction === 'up' && currentPrice < breakoutPrice) {
      return {
        shouldOpen: false,
        shouldClose: true,
      }
    }

    // 向下突破的关闭条件: 价格回升到突破价以上
    if (direction === 'down' && currentPrice > breakoutPrice) {
      return {
        shouldOpen: false,
        shouldClose: true,
      }
    }

    // 继续保持告警状态
    return {
      shouldOpen: false,
      shouldClose: false,
    }
  }

  // 如果没有活跃告警且没有前一个报价,无法判断突破
  if (!previousQuote) {
    return {
      shouldOpen: false,
      shouldClose: false,
    }
  }

  const previousPrice = previousQuote.currentPrice

  // 检查向上突破
  if (breakoutDirection === 'up' && previousPrice < breakoutPrice && currentPrice >= breakoutPrice) {
    const alertData: RealtimeAlertData = {
      stockCode: quote.tsCode,
      alertType: 'price_breakout',
      message: `${quote.tsCode} 向上突破 ${breakoutPrice} 元`,
      currentPrice,
      changePercent: parseFloat(String(quote.changePercent || 0)),
      triggerTime: new Date(),
      triggerData: {
        breakoutPrice,
        breakoutDirection,
        previousPrice,
        currentPrice,
      },
    }

    return {
      shouldOpen: true,
      shouldClose: false,
      alertData,
    }
  }

  // 检查向下突破
  if (breakoutDirection === 'down' && previousPrice > breakoutPrice && currentPrice <= breakoutPrice) {
    const alertData: RealtimeAlertData = {
      stockCode: quote.tsCode,
      alertType: 'price_breakout',
      message: `${quote.tsCode} 向下突破 ${breakoutPrice} 元`,
      currentPrice,
      changePercent: parseFloat(String(quote.changePercent || 0)),
      triggerTime: new Date(),
      triggerData: {
        breakoutPrice,
        breakoutDirection,
        previousPrice,
        currentPrice,
      },
    }

    return {
      shouldOpen: true,
      shouldClose: false,
      alertData,
    }
  }

  // 不满足任何条件
  return {
    shouldOpen: false,
    shouldClose: false,
  }
}

/**
 * 执行所有规则检查
 * 返回所有规则的检查结果
 */
export function checkAllRules(
  quote: RealtimeQuote,
  previousQuote: RealtimeQuote | undefined,
  rules: Array<{ ruleType: string; config: MonitorRuleConfig; currentAlertState?: AlertState }>,
  timeWindowManager?: TimeWindowManager
): Array<{ ruleType: string; result: AlertCheckResult }> {
  const results: Array<{ ruleType: string; result: AlertCheckResult }> = []

  for (const rule of rules) {
    let result: AlertCheckResult = {
      shouldOpen: false,
      shouldClose: false,
    }

    switch (rule.ruleType) {
      case 'price_change':
        result = checkRealtimePriceChange(quote, previousQuote, rule.config, rule.currentAlertState)
        break
      case 'volume_spike':
        result = checkRealtimeVolumeSpike(quote, rule.config, rule.currentAlertState, timeWindowManager)
        break
      case 'limit_up':
        result = checkRealtimeLimitUp(quote, previousQuote, rule.config, rule.currentAlertState)
        break
      case 'limit_down':
        result = checkRealtimeLimitDown(quote, previousQuote, rule.config, rule.currentAlertState)
        break
      case 'price_breakout':
        result = checkRealtimePriceBreakout(quote, previousQuote, rule.config, rule.currentAlertState)
        break
      default:
        break
    }

    results.push({
      ruleType: rule.ruleType,
      result,
    })
  }

  return results
}
