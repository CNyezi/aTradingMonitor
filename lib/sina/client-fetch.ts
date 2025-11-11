/**
 * 客户端新浪财经API调用（通过后端代理）
 * 避免浏览器CORS限制
 */

/**
 * 股票实时行情数据
 */
export interface RealtimeQuote {
  tsCode: string
  name: string
  currentPrice: number
  change: number
  changePercent: number
  open: number
  high: number
  low: number
  preClose: number
  volume: number
  amount: number
  bid1: number // 买一报价
  bidVolume1: number // 买一申请股数
  bid2: number
  bidVolume2: number
  bid3: number
  bidVolume3: number
  bid4: number
  bidVolume4: number
  bid5: number
  bidVolume5: number
  ask1: number // 卖一报价
  askVolume1: number // 卖一申请股数
  ask2: number
  askVolume2: number
  ask3: number
  askVolume3: number
  ask4: number
  askVolume4: number
  ask5: number
  askVolume5: number
  updateTime: Date
}

/**
 * 将Tushare格式代码转换为新浪格式
 */
function tsCodeToSina(tsCode: string): string {
  const [symbol, exchange] = tsCode.split('.')
  const prefix = exchange === 'SH' ? 'sh' : exchange === 'SZ' ? 'sz' : exchange === 'BJ' ? 'bj' : ''
  return `${prefix}${symbol}`.toLowerCase()
}

/**
 * 批量获取股票实时行情（通过后端代理）
 * @param tsCodes Tushare格式股票代码数组
 * @returns 实时行情数据Map
 */
export async function fetchRealtimeQuotes(tsCodes: string[]): Promise<Map<string, RealtimeQuote>> {
  const result = new Map<string, RealtimeQuote>()

  if (tsCodes.length === 0) {
    return result
  }

  try {
    // 转换为新浪格式
    const sinaCodes = tsCodes.map(tsCodeToSina)

    // 请求后端代理API
    const url = `/api/stocks/realtime?codes=${sinaCodes.join(',')}`
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error(`[ClientFetch] API error: ${response.status}`)
      return result
    }

    const text = await response.text()

    // 解析返回数据
    const lines = text.split('\n').filter((line) => line.trim())

    for (let i = 0; i < lines.length && i < tsCodes.length; i++) {
      const line = lines[i]
      const tsCode = tsCodes[i]

      // 提取数据：var hq_str_sh600089="数据";
      const match = line.match(/var hq_str_\w+="([^"]+)"/)
      if (!match || !match[1]) {
        console.warn(`[ClientFetch] No data for ${tsCode}`)
        continue
      }

      const fields = match[1].split(',')

      // 验证字段数量
      if (fields.length < 32) {
        console.warn(`[ClientFetch] Insufficient fields for ${tsCode}: ${fields.length}`)
        continue
      }

      // 解析字段
      const name = fields[0]
      const open = parseFloat(fields[1])
      const prevClose = parseFloat(fields[2])
      const current = parseFloat(fields[3])
      const high = parseFloat(fields[4])
      const low = parseFloat(fields[5])
      const volumeInShares = parseFloat(fields[8])
      const amountInYuan = parseFloat(fields[9])

      // 买卖盘数据
      const bidVolume1 = parseFloat(fields[10])
      const bid1 = parseFloat(fields[11])
      const bidVolume2 = parseFloat(fields[12])
      const bid2 = parseFloat(fields[13])
      const bidVolume3 = parseFloat(fields[14])
      const bid3 = parseFloat(fields[15])
      const bidVolume4 = parseFloat(fields[16])
      const bid4 = parseFloat(fields[17])
      const bidVolume5 = parseFloat(fields[18])
      const bid5 = parseFloat(fields[19])
      const askVolume1 = parseFloat(fields[20])
      const ask1 = parseFloat(fields[21])
      const askVolume2 = parseFloat(fields[22])
      const ask2 = parseFloat(fields[23])
      const askVolume3 = parseFloat(fields[24])
      const ask3 = parseFloat(fields[25])
      const askVolume4 = parseFloat(fields[26])
      const ask4 = parseFloat(fields[27])
      const askVolume5 = parseFloat(fields[28])
      const ask5 = parseFloat(fields[29])

      const date = fields[30]
      const time = fields[31]

      // 数据有效性检查
      if (isNaN(current) || current <= 0) {
        console.warn(`[ClientFetch] Invalid price for ${tsCode}: ${current}`)
        continue
      }

      // 计算涨跌
      const change = current - prevClose
      const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0

      // 单位转换
      const volume = volumeInShares
      const amount = amountInYuan

      result.set(tsCode, {
        tsCode,
        name,
        currentPrice: current,
        change,
        changePercent,
        open,
        high,
        low,
        preClose: prevClose,
        volume,
        amount,
        bid1,
        bidVolume1: bidVolume1 / 100, // 转为手
        bid2,
        bidVolume2: bidVolume2 / 100,
        bid3,
        bidVolume3: bidVolume3 / 100,
        bid4,
        bidVolume4: bidVolume4 / 100,
        bid5,
        bidVolume5: bidVolume5 / 100,
        ask1,
        askVolume1: askVolume1 / 100,
        ask2,
        askVolume2: askVolume2 / 100,
        ask3,
        askVolume3: askVolume3 / 100,
        ask4,
        askVolume4: askVolume4 / 100,
        ask5,
        askVolume5: askVolume5 / 100,
        updateTime: new Date(`${date} ${time}`),
      })
    }

    console.log(`[ClientFetch] Successfully fetched ${result.size}/${tsCodes.length} quotes`)
  } catch (error) {
    console.error('[ClientFetch] Failed to fetch realtime quotes:', error)
  }

  return result
}

/**
 * 获取单只股票的实时行情
 */
export async function fetchRealtimeQuote(tsCode: string): Promise<RealtimeQuote | null> {
  const result = await fetchRealtimeQuotes([tsCode])
  return result.get(tsCode) || null
}
