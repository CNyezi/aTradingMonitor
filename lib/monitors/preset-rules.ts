/**
 * A股典型监控规则预设
 *
 * 根据A股市场特点设计的常用监控规则模板
 */

export interface PresetRule {
  id: string
  name: string
  nameEn: string
  nameJa: string
  description: string
  descriptionEn: string
  descriptionJa: string
  category: 'limit' | 'price_change' | 'volume' | 'breakout'
  ruleType: 'price_change' | 'volume_spike' | 'limit_up' | 'limit_down' | 'price_breakout'
  config: any
  usage: string // 使用场景说明
  usageEn: string
  usageJa: string
}

export const PRESET_RULES: PresetRule[] = [
  // ========== 涨跌停监控 ==========
  {
    id: 'limit_up_alert',
    name: '涨停预警（主板10%）',
    nameEn: 'Limit Up Alert (Main Board 10%)',
    nameJa: 'ストップ高アラート（メインボード10%）',
    description: '当股票涨幅接近10%时提醒，适用于主板、中小板股票',
    descriptionEn: 'Alert when stock approaches 10% daily gain, for main board stocks',
    descriptionJa: '日次上昇率が10%に近づいた時にアラート、メインボード銘柄向け',
    category: 'limit',
    ruleType: 'limit_up',
    config: {
      limitThreshold: 10,
    },
    usage: '捕捉强势股，涨停通常意味着强烈的买盘需求或重大利好消息。连续涨停可能是热点题材或妖股',
    usageEn: 'Catch strong stocks. Limit up usually indicates strong buying demand or major positive news. Consecutive limit ups may signal hot themes',
    usageJa: '強い銘柄を捕捉。ストップ高は通常、強い買い需要または重要なポジティブニュースを示します',
  },
  {
    id: 'limit_up_gem',
    name: '涨停预警（创业板/科创板20%）',
    nameEn: 'Limit Up Alert (GEM/STAR 20%)',
    nameJa: 'ストップ高アラート（マザーズ/科創板20%）',
    description: '当股票涨幅接近20%时提醒，适用于创业板、科创板、北交所',
    descriptionEn: 'Alert when stock approaches 20% daily gain, for GEM/STAR/BSE',
    descriptionJa: '日次上昇率が20%に近づいた時にアラート、マザーズ/科創板向け',
    category: 'limit',
    ruleType: 'limit_up',
    config: {
      limitThreshold: 20,
    },
    usage: '监控高成长性板块的涨停，20%涨停说明市场情绪极度亢奋',
    usageEn: 'Monitor limit up in growth sectors. 20% limit up indicates extremely bullish sentiment',
    usageJa: '成長セクターのストップ高を監視。20%ストップ高は極めて強気なセンチメントを示します',
  },
  {
    id: 'limit_down_alert',
    name: '跌停预警（主板10%）',
    nameEn: 'Limit Down Alert (Main Board 10%)',
    nameJa: 'ストップ安アラート（メインボード10%）',
    description: '当股票跌幅接近10%时提醒，适用于主板、中小板股票',
    descriptionEn: 'Alert when stock approaches 10% daily loss, for main board stocks',
    descriptionJa: '日次下落率が10%に近づいた時にアラート、メインボード銘柄向け',
    category: 'limit',
    ruleType: 'limit_down',
    config: {
      limitThreshold: 10,
    },
    usage: '风险预警，跌停可能意味着重大利空、财务问题或市场恐慌性抛售',
    usageEn: 'Risk warning. Limit down may indicate major negative news, financial issues, or panic selling',
    usageJa: 'リスク警告。ストップ安は重大な悪材料、財務問題、またはパニック売りを示す可能性があります',
  },
  {
    id: 'limit_down_gem',
    name: '跌停预警（创业板/科创板20%）',
    nameEn: 'Limit Down Alert (GEM/STAR 20%)',
    nameJa: 'ストップ安アラート（マザーズ/科創板20%）',
    description: '当股票跌幅接近20%时提醒，适用于创业板、科创板、北交所',
    descriptionEn: 'Alert when stock approaches 20% daily loss, for GEM/STAR/BSE',
    descriptionJa: '日次下落率が20%に近づいた時にアラート、マザーズ/科創板向け',
    category: 'limit',
    ruleType: 'limit_down',
    config: {
      limitThreshold: 20,
    },
    usage: '严重风险信号，20%跌停说明市场极度悲观，需要评估是否止损',
    usageEn: 'Severe risk signal. 20% limit down indicates extreme pessimism, consider stop loss',
    usageJa: '深刻なリスクシグナル。20%ストップ安は極度の悲観を示し、損切りを検討する必要があります',
  },

  // ========== 大幅波动监控 ==========
  {
    id: 'strong_rally',
    name: '强势上涨（单日+5%以上）',
    nameEn: 'Strong Rally (Daily +5%+)',
    nameJa: '強い上昇（日次+5%以上）',
    description: '单日涨幅超过5%，表示显著上涨',
    descriptionEn: 'Daily gain exceeds 5%, indicating significant upward movement',
    descriptionJa: '日次上昇率が5%を超え、顕著な上昇を示します',
    category: 'price_change',
    ruleType: 'price_change',
    config: {
      priceChangeThreshold: 5,
    },
    usage: '捕捉强势个股，5%涨幅通常伴随利好消息或资金关注，可能是短期交易机会',
    usageEn: 'Catch strong performers. 5% gain usually comes with positive news or capital attention, potential short-term opportunity',
    usageJa: '強い銘柄を捕捉。5%上昇は通常、好材料や資金流入を伴い、短期取引機会の可能性があります',
  },
  {
    id: 'near_limit_up',
    name: '接近涨停（单日+7%以上）',
    nameEn: 'Near Limit Up (Daily +7%+)',
    nameJa: 'ストップ高接近（日次+7%以上）',
    description: '单日涨幅超过7%，接近涨停板',
    descriptionEn: 'Daily gain exceeds 7%, approaching limit up',
    descriptionJa: '日次上昇率が7%を超え、ストップ高に接近',
    category: 'price_change',
    ruleType: 'price_change',
    config: {
      priceChangeThreshold: 7,
    },
    usage: '极强势信号，7%以上涨幅接近涨停，可能次日继续强势或开板分化',
    usageEn: 'Very strong signal. 7%+ gain near limit up, may continue strong or diverge next day',
    usageJa: '非常に強いシグナル。7%以上の上昇でストップ高に近く、翌日も強い可能性があります',
  },
  {
    id: 'sharp_decline',
    name: '大幅下跌（单日-5%以上）',
    nameEn: 'Sharp Decline (Daily -5%+)',
    nameJa: '大幅下落（日次-5%以上）',
    description: '单日跌幅超过5%，表示显著下跌',
    descriptionEn: 'Daily loss exceeds 5%, indicating significant downward movement',
    descriptionJa: '日次下落率が5%を超え、顕著な下落を示します',
    category: 'price_change',
    ruleType: 'price_change',
    config: {
      priceChangeThreshold: 5,
    },
    usage: '风险警示，5%跌幅可能是利空消息、主力出货或技术破位，需要警惕',
    usageEn: 'Risk alert. 5% decline may indicate negative news, major selling, or technical breakdown',
    usageJa: 'リスク警告。5%下落は悪材料、主力売り、またはテクニカル崩れの可能性があります',
  },
  {
    id: 'volatile_trading',
    name: '剧烈震荡（单日波动8%以上）',
    nameEn: 'Volatile Trading (Daily Range 8%+)',
    nameJa: '激しい変動（日次変動8%以上）',
    description: '盘中震荡幅度超过8%，多空激烈博弈',
    descriptionEn: 'Intraday volatility exceeds 8%, indicating intense battle between bulls and bears',
    descriptionJa: '日中変動幅が8%を超え、激しい売買が行われています',
    category: 'price_change',
    ruleType: 'price_change',
    config: {
      priceChangeThreshold: 8,
    },
    usage: '高波动信号，8%震荡说明多空分歧严重，适合短线高手，普通投资者需谨慎',
    usageEn: 'High volatility signal. 8% swing shows strong disagreement, suitable for skilled traders',
    usageJa: '高ボラティリティシグナル。8%の変動は意見の相違が大きく、熟練トレーダー向けです',
  },

  // ========== 成交量异动 ==========
  {
    id: 'volume_breakout',
    name: '放量突破（2倍量能）',
    nameEn: 'Volume Breakout (2x Volume)',
    nameJa: '出来高急増（2倍）',
    description: '成交量是过去1小时均量的2倍，可能突破关键位',
    descriptionEn: 'Volume is 2x the past hour average, potential key level breakout',
    descriptionJa: '出来高が過去1時間平均の2倍、重要な水準のブレイクアウトの可能性',
    category: 'volume',
    ruleType: 'volume_spike',
    config: {
      volumeMultiplier: 2,
      volumePeriod: 60,
    },
    usage: '量价配合，2倍量能突破通常伴随价格突破关键位置，是买入信号',
    usageEn: 'Volume-price coordination. 2x volume usually accompanies price breakout, a buy signal',
    usageJa: '出来高と価格の連動。2倍の出来高は通常、価格のブレイクアウトを伴い、買いシグナルです',
  },
  {
    id: 'massive_volume',
    name: '巨量异动（5倍量能）',
    nameEn: 'Massive Volume (5x Volume)',
    nameJa: '巨大出来高（5倍）',
    description: '成交量是过去1小时均量的5倍，极度活跃',
    descriptionEn: 'Volume is 5x the past hour average, extremely active',
    descriptionJa: '出来高が過去1時間平均の5倍、極めて活発',
    category: 'volume',
    ruleType: 'volume_spike',
    config: {
      volumeMultiplier: 5,
      volumePeriod: 60,
    },
    usage: '主力异动信号，5倍巨量可能是主力建仓、拉升或出货，需要结合价格分析',
    usageEn: 'Major player signal. 5x volume may indicate accumulation, markup, or distribution',
    usageJa: '主力の動きシグナル。5倍の巨大出来高は主力の買い集め、上昇、または売り抜けの可能性',
  },
  {
    id: 'sustained_volume',
    name: '持续放量（3倍量能30分钟）',
    nameEn: 'Sustained Volume (3x for 30min)',
    nameJa: '継続的出来高急増（3倍30分間）',
    description: '成交量持续30分钟保持3倍以上，趋势强劲',
    descriptionEn: 'Volume sustains 3x+ for 30 minutes, strong trend',
    descriptionJa: '出来高が30分間3倍以上を維持、強いトレンド',
    category: 'volume',
    ruleType: 'volume_spike',
    config: {
      volumeMultiplier: 3,
      volumePeriod: 30,
    },
    usage: '确认趋势，持续放量说明资金持续流入，趋势延续性强',
    usageEn: 'Trend confirmation. Sustained volume indicates continuous capital inflow, strong trend continuation',
    usageJa: 'トレンド確認。継続的な出来高急増は資金の継続的流入を示し、トレンド継続性が強い',
  },

  // ========== 关键价位突破 ==========
  {
    id: 'round_number_20',
    name: '突破20元整数关口',
    nameEn: 'Break 20 Yuan Round Number',
    nameJa: '20元の整数関門突破',
    description: '突破20元心理价位，可能继续上涨',
    descriptionEn: 'Break 20 yuan psychological level, may continue rising',
    descriptionJa: '20元の心理的水準を突破、上昇継続の可能性',
    category: 'breakout',
    ruleType: 'price_breakout',
    config: {
      breakoutPrice: 20,
      breakoutDirection: 'up',
    },
    usage: '心理关口突破，整数价位如20元、50元、100元通常是重要心理位，突破后有惯性',
    usageEn: 'Psychological level break. Round numbers like 20, 50, 100 yuan are key levels, breakout has momentum',
    usageJa: '心理的水準のブレイク。20、50、100元などの整数は重要な水準で、突破後は勢いがあります',
  },
  {
    id: 'round_number_50',
    name: '突破50元整数关口',
    nameEn: 'Break 50 Yuan Round Number',
    nameJa: '50元の整数関門突破',
    description: '突破50元心理价位，进入新高区域',
    descriptionEn: 'Break 50 yuan psychological level, entering new high territory',
    descriptionJa: '50元の心理的水準を突破、新高値圏に突入',
    category: 'breakout',
    ruleType: 'price_breakout',
    config: {
      breakoutPrice: 50,
      breakoutDirection: 'up',
    },
    usage: '重要关口，50元是中价股重要关口，突破后可能打开上涨空间',
    usageEn: 'Important level. 50 yuan is key for mid-price stocks, breakout may open upside',
    usageJa: '重要な水準。50元は中価格銘柄の重要な関門で、突破後は上値余地が広がる可能性',
  },
]

/**
 * 按类别分组预设规则
 */
export function getPresetRulesByCategory() {
  return {
    limit: PRESET_RULES.filter((r) => r.category === 'limit'),
    price_change: PRESET_RULES.filter((r) => r.category === 'price_change'),
    volume: PRESET_RULES.filter((r) => r.category === 'volume'),
    breakout: PRESET_RULES.filter((r) => r.category === 'breakout'),
  }
}

/**
 * 根据ID获取预设规则
 */
export function getPresetRuleById(id: string) {
  return PRESET_RULES.find((r) => r.id === id)
}
