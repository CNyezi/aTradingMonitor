/**
 * 新浪财经实时行情API客户端
 * 接口文档：https://hq.sinajs.cn/list=股票代码
 */

import { tsCodeToSina } from './code-converter'
import type { SinaQuote, BatchQuoteResult } from './types'

/**
 * 新浪股票行情客户端
 */
export class SinaStockClient {
  private readonly baseUrl = 'https://hq.sinajs.cn'
  private readonly timeout = 5000 // 5秒超时

  /**
   * 获取随机User-Agent（防止被识别为爬虫）
   */
  private getRandomUserAgent(): string {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    ]

    return userAgents[Math.floor(Math.random() * userAgents.length)]
  }

  /**
   * 解析新浪返回的单行数据
   * @param line 原始数据行，如：var hq_str_sh600089="平安银行,9.170,9.190,..."
   * @param tsCode Tushare格式代码
   * @returns 解析后的行情数据，失败返回null
   */
  private parseSinaLine(line: string, tsCode: string): SinaQuote | null {
    try {
      // 提取数据部分：var hq_str_sh600089="数据";
      const match = line.match(/var hq_str_\w+="([^"]+)"/)
      if (!match || !match[1]) {
        return null
      }

      const fields = match[1].split(',')

      // 验证字段数量（至少32个字段）
      if (fields.length < 32) {
        console.warn(`[SinaClient] Insufficient fields for ${tsCode}: ${fields.length}`)
        return null
      }

      // 解析关键字段
      const name = fields[0]
      const open = parseFloat(fields[1])
      const prevClose = parseFloat(fields[2])
      const current = parseFloat(fields[3])
      const high = parseFloat(fields[4])
      const low = parseFloat(fields[5])
      const bid = parseFloat(fields[6])
      const ask = parseFloat(fields[7])
      const volumeInShares = parseFloat(fields[8]) // 单位：股
      const amountInYuan = parseFloat(fields[9]) // 单位：元
      const date = fields[30] // YYYY-MM-DD
      const time = fields[31] // HH:MM:SS

      // 数据有效性检查
      if (isNaN(current) || current <= 0) {
        console.warn(`[SinaClient] Invalid current price for ${tsCode}: ${current}`)
        return null
      }

      // 计算涨跌额和涨跌幅
      const change = current - prevClose
      const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0

      // 单位转换
      const volume = volumeInShares / 100 // 转为手（1手=100股）
      const amount = amountInYuan / 10000 // 转为万元

      // 构建更新时间
      const updateTime = new Date(`${date} ${time}`)

      return {
        tsCode,
        name,
        currentPrice: current,
        change,
        changePercent,
        open,
        high,
        low,
        prevClose,
        volume,
        amount,
        bid,
        ask,
        updateTime,
      }
    } catch (error) {
      console.error(`[SinaClient] Failed to parse line for ${tsCode}:`, error)
      return null
    }
  }

  /**
   * 批量获取股票实时行情
   * @param tsCodes Tushare格式股票代码数组，如 ["600089.SH", "000001.SZ"]
   * @returns 批量查询结果，包含成功和失败的代码
   */
  async getBatchRealtimeQuotes(tsCodes: string[]): Promise<BatchQuoteResult> {
    const result: BatchQuoteResult = {
      success: new Map(),
      failed: [],
    }

    if (tsCodes.length === 0) {
      return result
    }

    try {
      // 1. 转换为新浪格式代码
      const sinaCodes = tsCodes.map(tsCodeToSina)

      // 2. 构建请求URL（批量查询，逗号分隔）
      const url = `${this.baseUrl}/list=${sinaCodes.join(',')}`

      // 3. 发起请求（关键：必须添加Referer头）
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(url, {
        headers: {
          Referer: 'https://finance.sina.com.cn',
          'User-Agent': this.getRandomUserAgent(),
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // 4. 获取响应文本
      const text = await response.text()

      // 5. 按行解析数据
      const lines = text.split('\n').filter((line) => line.trim())

      for (let i = 0; i < lines.length && i < tsCodes.length; i++) {
        const tsCode = tsCodes[i]
        const quote = this.parseSinaLine(lines[i], tsCode)

        if (quote) {
          result.success.set(tsCode, quote)
        } else {
          result.failed.push(tsCode)
        }
      }

      // 6. 检查是否有遗漏的代码
      for (const tsCode of tsCodes) {
        if (!result.success.has(tsCode) && !result.failed.includes(tsCode)) {
          result.failed.push(tsCode)
        }
      }

      console.log(
        `[SinaClient] Batch query completed: ${result.success.size} success, ${result.failed.length} failed`
      )
    } catch (error) {
      console.error('[SinaClient] Batch query error:', error)

      // 请求失败，所有代码标记为失败
      result.failed = tsCodes
    }

    return result
  }

  /**
   * 获取单只股票的实时行情
   * @param tsCode Tushare格式股票代码
   * @returns 行情数据，失败返回null
   */
  async getRealtimeQuote(tsCode: string): Promise<SinaQuote | null> {
    const result = await this.getBatchRealtimeQuotes([tsCode])

    if (result.success.size > 0) {
      return result.success.get(tsCode) || null
    }

    return null
  }
}

/**
 * 获取新浪股票客户端单例
 */
let sinaClientInstance: SinaStockClient | null = null

export function getSinaClient(): SinaStockClient {
  if (!sinaClientInstance) {
    sinaClientInstance = new SinaStockClient()
  }
  return sinaClientInstance
}
