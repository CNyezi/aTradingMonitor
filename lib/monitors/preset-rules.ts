/**
 * A股盘中实时监控规则预设
 *
 * 聚焦于捕捉盘中关键异动，防止错过重要机会
 * 设计原则：高信噪比、低误报率、实战导向
 */

export interface PresetRule {
  id: string
  name: string
  nameEn: string
  nameJa: string
  description: string
  descriptionEn: string
  descriptionJa: string
  category: 'core' | 'risk' | 'advanced' // 核心必备、风险预警、进阶策略
  priority: 'high' | 'medium' | 'low' // 优先级
  ruleType: 'price_change' | 'volume_spike' | 'limit_up' | 'limit_down' | 'price_breakout'
  config: any
  usage: string // 使用场景说明
  usageEn: string
  usageJa: string
}

export const PRESET_RULES: PresetRule[] = [
  // ========== 核心必备：盘中异动监控 ==========

  // 【最重要】量价配合信号
  {
    id: 'volume_price_surge',
    name: '量价齐升（+3%且2倍量）',
    nameEn: 'Volume & Price Surge (+3% & 2x Vol)',
    nameJa: '出来高価格同時上昇（+3%＆2倍）',
    description: '涨幅超3%且成交量翻倍，量价配合最佳信号',
    descriptionEn: 'Price up 3%+ with 2x volume, best volume-price coordination signal',
    descriptionJa: '3%以上上昇かつ出来高2倍、最良の出来高価格連動シグナル',
    category: 'core',
    priority: 'high',
    ruleType: 'volume_spike',
    config: {
      volumeMultiplier: 2,
      volumePeriod: 60,
      priceChangeThreshold: 3,  // ✨ 新增：价格阈值 3%
      priceDirection: 'up',      // ✨ 新增：要求上涨
    },
    usage: '【核心】主力启动信号，量价配合说明资金真实介入，误报率最低',
    usageEn: '[CORE] Major player entry signal. Volume-price coordination indicates real capital inflow, lowest false positive rate',
    usageJa: '【コア】主力始動シグナル。出来高価格連動は実際の資金流入を示し、誤報率最低',
  },

  // 【核心】显著上涨
  {
    id: 'strong_rally_5pct',
    name: '强势拉升（+5%）',
    nameEn: 'Strong Rally (+5%)',
    nameJa: '強力上昇（+5%）',
    description: '盘中涨幅突破5%，捕捉强势股',
    descriptionEn: 'Intraday gain exceeds 5%, catch strong performers',
    descriptionJa: '日中上昇率5%突破、強い銘柄を捕捉',
    category: 'core',
    priority: 'high',
    ruleType: 'price_change',
    config: {
      priceChangeThreshold: 5,
    },
    usage: '【核心】5%是强势分界线，通常伴随题材热点或消息面刺激',
    usageEn: '[CORE] 5% is the strong momentum threshold, usually with theme or news catalyst',
    usageJa: '【コア】5%は強いモメンタムの閾値、通常テーマやニュース材料を伴う',
  },

  // 【核心】涨停预警
  {
    id: 'approaching_limit_up',
    name: '冲击涨停（+7%）',
    nameEn: 'Approaching Limit Up (+7%)',
    nameJa: 'ストップ高接近（+7%）',
    description: '涨幅超7%，接近涨停板，可能封板',
    descriptionEn: 'Gain exceeds 7%, approaching limit up, may seal',
    descriptionJa: '上昇率7%超、ストップ高接近、張り付く可能性',
    category: 'core',
    priority: 'high',
    ruleType: 'limit_up',
    config: {
      limitThreshold: 7,
    },
    usage: '【核心】准涨停状态，提前捕捉涨停机会，次日可能继续强势',
    usageEn: '[CORE] Near-limit-up state, catch limit up opportunity early, may continue strong next day',
    usageJa: '【コア】準ストップ高状態、早期に機会捕捉、翌日も強い可能性',
  },

  // ========== 风险预警：防止损失扩大 ==========

  // 【风险】急跌预警
  {
    id: 'sharp_drop_5pct',
    name: '急跌预警（-5%）',
    nameEn: 'Sharp Drop Alert (-5%)',
    nameJa: '急落警告（-5%）',
    description: '盘中跌幅超5%，风险警示',
    descriptionEn: 'Intraday loss exceeds 5%, risk warning',
    descriptionJa: '日中下落率5%超、リスク警告',
    category: 'risk',
    priority: 'high',
    ruleType: 'price_change',
    config: {
      priceChangeThreshold: 5,
    },
    usage: '【风险】5%跌幅是风险分界线，可能是利空消息或主力出货，需要评估止损',
    usageEn: '[RISK] 5% decline is risk threshold, may be negative news or major selling, consider stop loss',
    usageJa: '【リスク】5%下落はリスク閾値、悪材料や主力売りの可能性、損切り検討',
  },

  // 【风险】跌停预警
  {
    id: 'approaching_limit_down',
    name: '跌停风险（-7%）',
    nameEn: 'Limit Down Risk (-7%)',
    nameJa: 'ストップ安リスク（-7%）',
    description: '跌幅超7%，可能跌停',
    descriptionEn: 'Loss exceeds 7%, may hit limit down',
    descriptionJa: '下落率7%超、ストップ安の可能性',
    category: 'risk',
    priority: 'high',
    ruleType: 'limit_down',
    config: {
      limitThreshold: 7,
    },
    usage: '【风险】严重风险信号，接近或已经跌停，需要立即评估是否止损',
    usageEn: '[RISK] Severe risk signal, near or at limit down, immediate stop loss evaluation needed',
    usageJa: '【リスク】深刻なリスクシグナル、ストップ安接近または到達、即座に損切り評価必要',
  },

  // 【风险】放量下跌
  {
    id: 'volume_selloff',
    name: '放量杀跌（-3%且2倍量）',
    nameEn: 'Volume Selloff (-3% & 2x Vol)',
    nameJa: '出来高急増下落（-3%＆2倍）',
    description: '跌幅超3%且放量，主力可能出货',
    descriptionEn: 'Price down 3%+ with 2x volume, potential distribution',
    descriptionJa: '3%以上下落かつ出来高急増、主力売り抜けの可能性',
    category: 'risk',
    priority: 'high',
    ruleType: 'volume_spike',
    config: {
      volumeMultiplier: 2,
      volumePeriod: 60,
      priceChangeThreshold: 3,  // ✨ 新增：价格阈值 3%
      priceDirection: 'down',    // ✨ 新增：要求下跌
    },
    usage: '【风险】量价背离，放量下跌通常是主力出货信号，风险极高',
    usageEn: '[RISK] Volume-price divergence. Volume selloff usually indicates major distribution, high risk',
    usageJa: '【リスク】出来高価格乖離。出来高急増下落は通常主力売り抜けシグナル、高リスク',
  },

  // ========== 进阶策略：精细化监控 ==========

  // 【进阶】巨量异动
  {
    id: 'massive_volume_5x',
    name: '巨量异动（5倍量）',
    nameEn: 'Massive Volume (5x)',
    nameJa: '巨大出来高（5倍）',
    description: '成交量暴增5倍，重大事件',
    descriptionEn: 'Volume surges 5x, major event',
    descriptionJa: '出来高5倍急増、重大イベント',
    category: 'advanced',
    priority: 'medium',
    ruleType: 'volume_spike',
    config: {
      volumeMultiplier: 5,
      volumePeriod: 60,
    },
    usage: '【进阶】可能是定增、并购、重组等重大事件，需要结合价格判断方向',
    usageEn: '[ADVANCED] May be major events like private placement, M&A, restructuring. Need price confirmation',
    usageJa: '【上級】増資、M&A、組織再編等の重大イベントの可能性。価格確認必要',
  },

  // 【进阶】持续强势
  {
    id: 'sustained_strength',
    name: '持续强势（+3%且30分钟）',
    nameEn: 'Sustained Strength (+3% for 30min)',
    nameJa: '継続強勢（+3%30分間）',
    description: '涨幅持续30分钟保持3%以上',
    descriptionEn: 'Maintains 3%+ gain for 30 minutes',
    descriptionJa: '3%以上の上昇を30分間維持',
    category: 'advanced',
    priority: 'medium',
    ruleType: 'volume_spike',
    config: {
      volumeMultiplier: 3,
      volumePeriod: 30,
    },
    usage: '【进阶】确认趋势延续性，持续强势说明买盘持续涌入',
    usageEn: '[ADVANCED] Confirms trend continuation. Sustained strength indicates continuous buying pressure',
    usageJa: '【上級】トレンド継続確認。継続的強勢は買い圧力の継続を示す',
  },

  // 【进阶】冲高回落
  {
    id: 'failed_breakout',
    name: '冲高回落（曾+5%现+2%）',
    nameEn: 'Failed Breakout (Was +5% Now +2%)',
    nameJa: '高値引け（一時+5%現在+2%）',
    description: '盘中曾涨5%但现在回落至2%',
    descriptionEn: 'Was up 5% intraday but pulled back to 2%',
    descriptionJa: '日中5%上昇したが2%に押し戻し',
    category: 'advanced',
    priority: 'low',
    ruleType: 'price_change',
    config: {
      priceChangeThreshold: 2,
    },
    usage: '【进阶】冲高回落可能是主力诱多出货，或上方压力过大，需谨慎',
    usageEn: '[ADVANCED] Pullback may indicate bull trap or strong resistance, be cautious',
    usageJa: '【上級】押し戻しは強気罠や強い抵抗を示す可能性、注意',
  },

  // 【进阶】涨停板（主板）
  {
    id: 'limit_up_main_board',
    name: '涨停封板（主板10%）',
    nameEn: 'Limit Up Sealed (Main 10%)',
    nameJa: 'ストップ高（メイン10%）',
    description: '涨停封板，适用主板股票',
    descriptionEn: 'Limit up sealed, for main board',
    descriptionJa: 'ストップ高張り付き、メインボード向け',
    category: 'advanced',
    priority: 'medium',
    ruleType: 'limit_up',
    config: {
      limitThreshold: 10,
    },
    usage: '【进阶】涨停封板说明买盘极强，次日可能继续强势或开板分化',
    usageEn: '[ADVANCED] Sealed limit up shows extreme buying power, may continue or diverge next day',
    usageJa: '【上級】ストップ高張り付きは極めて強い買い圧力、翌日継続または分岐の可能性',
  },

  // 【进阶】涨停板（创业板/科创板）
  {
    id: 'limit_up_gem_star',
    name: '涨停封板（创业板/科创板20%）',
    nameEn: 'Limit Up Sealed (GEM/STAR 20%)',
    nameJa: 'ストップ高（マザーズ/科創20%）',
    description: '涨停封板，适用创业板/科创板',
    descriptionEn: 'Limit up sealed, for GEM/STAR',
    descriptionJa: 'ストップ高張り付き、マザーズ/科創板向け',
    category: 'advanced',
    priority: 'medium',
    ruleType: 'limit_up',
    config: {
      limitThreshold: 20,
    },
    usage: '【进阶】20%涨停说明市场情绪极度亢奋，通常是热点题材龙头',
    usageEn: '[ADVANCED] 20% limit up indicates extreme bullish sentiment, usually hot sector leader',
    usageJa: '【上級】20%ストップ高は極度の強気センチメント、通常ホットセクターのリーダー',
  },
]

/**
 * 按类别分组预设规则
 */
export function getPresetRulesByCategory() {
  return {
    core: PRESET_RULES.filter((r) => r.category === 'core'),
    risk: PRESET_RULES.filter((r) => r.category === 'risk'),
    advanced: PRESET_RULES.filter((r) => r.category === 'advanced'),
  }
}

/**
 * 按优先级分组预设规则
 */
export function getPresetRulesByPriority() {
  return {
    high: PRESET_RULES.filter((r) => r.priority === 'high'),
    medium: PRESET_RULES.filter((r) => r.priority === 'medium'),
    low: PRESET_RULES.filter((r) => r.priority === 'low'),
  }
}

/**
 * 获取推荐的核心规则组合（最小必备）
 */
export function getRecommendedCoreRules() {
  return PRESET_RULES.filter((r) => r.category === 'core')
}

/**
 * 根据ID获取预设规则
 */
export function getPresetRuleById(id: string) {
  return PRESET_RULES.find((r) => r.id === id)
}
