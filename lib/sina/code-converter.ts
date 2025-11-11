/**
 * 股票代码格式转换工具
 * Tushare格式 ↔ 新浪格式
 */

/**
 * 将Tushare格式代码转换为新浪格式
 * @param tsCode Tushare格式代码，如 "600089.SH"
 * @returns 新浪格式代码，如 "sh600089"
 * @example
 * tsCodeToSina("600089.SH") // => "sh600089"
 * tsCodeToSina("000001.SZ") // => "sz000001"
 * tsCodeToSina("430047.BJ") // => "bj430047"
 */
export function tsCodeToSina(tsCode: string): string {
  const [symbol, exchange] = tsCode.split('.')

  if (!symbol || !exchange) {
    throw new Error(`Invalid tsCode format: ${tsCode}`)
  }

  // 交易所前缀映射
  const exchangeMap: Record<string, string> = {
    SH: 'sh', // 上海证券交易所
    SZ: 'sz', // 深圳证券交易所
    BJ: 'bj', // 北京证券交易所
  }

  const prefix = exchangeMap[exchange.toUpperCase()]

  if (!prefix) {
    throw new Error(`Unsupported exchange: ${exchange}. Supported: SH, SZ, BJ`)
  }

  return `${prefix}${symbol}`.toLowerCase()
}

/**
 * 将新浪格式代码转换为Tushare格式
 * @param sinaCode 新浪格式代码，如 "sh600089"
 * @returns Tushare格式代码，如 "600089.SH"
 * @example
 * sinaToTsCode("sh600089") // => "600089.SH"
 * sinaToTsCode("sz000001") // => "000001.SZ"
 * sinaToTsCode("bj430047") // => "430047.BJ"
 */
export function sinaToTsCode(sinaCode: string): string {
  const code = sinaCode.toLowerCase()

  // 提取前缀和股票代码
  const match = code.match(/^(sh|sz|bj)(\d{6})$/)

  if (!match) {
    throw new Error(`Invalid sinaCode format: ${sinaCode}`)
  }

  const [, prefix, symbol] = match

  // 前缀映射回交易所后缀
  const exchangeMap: Record<string, string> = {
    sh: 'SH',
    sz: 'SZ',
    bj: 'BJ',
  }

  const exchange = exchangeMap[prefix]

  return `${symbol}.${exchange}`
}

/**
 * 批量转换Tushare格式到新浪格式
 * @param tsCodes Tushare格式代码数组
 * @returns 新浪格式代码数组
 */
export function batchTsCodeToSina(tsCodes: string[]): string[] {
  return tsCodes.map(tsCodeToSina)
}

/**
 * 批量转换新浪格式到Tushare格式
 * @param sinaCodes 新浪格式代码数组
 * @returns Tushare格式代码数组
 */
export function batchSinaToTsCode(sinaCodes: string[]): string[] {
  return sinaCodes.map(sinaToTsCode)
}

/**
 * 验证是否为有效的Tushare格式代码
 * @param tsCode 待验证的代码
 * @returns 是否有效
 */
export function isValidTsCode(tsCode: string): boolean {
  return /^\d{6}\.(SH|SZ|BJ)$/i.test(tsCode)
}

/**
 * 验证是否为有效的新浪格式代码
 * @param sinaCode 待验证的代码
 * @returns 是否有效
 */
export function isValidSinaCode(sinaCode: string): boolean {
  return /^(sh|sz|bj)\d{6}$/i.test(sinaCode)
}
