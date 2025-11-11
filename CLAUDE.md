# 非常重要
1. 需要了解项目的基础框架和基本使用规则，务必访问

https://context7.com/websites/nexty_dev/llms.txt?tokens=10000

2. 需要了解项目规则，请务必访问根目录下.cursor/rules内的文档

---

## 多语言（i18n）实现规范

### 标准流程（必须遵守）

当添加新的多语言功能时，必须按照以下步骤操作：

#### 1. 创建翻译文件
在 `i18n/messages/{locale}/` 目录下创建对应的JSON翻译文件，支持的语言：
- `zh` - 简体中文
- `en` - 英文
- `ja` - 日文

示例文件结构：
```
i18n/messages/
  ├── zh/
  │   ├── FeatureName.json
  │   └── Dashboard/User/SubFeature.json
  ├── en/
  │   ├── FeatureName.json
  │   └── Dashboard/User/SubFeature.json
  └── ja/
      ├── FeatureName.json
      └── Dashboard/User/SubFeature.json
```

#### 2. 更新 i18n/request.ts 配置（关键步骤）
**⚠️ 这是最容易遗忘的步骤！**

在 `i18n/request.ts` 的 `messages` 对象中添加新的翻译文件导入：

```typescript
return {
  locale,
  messages: {
    Landing: (await import(`./messages/${locale}/Landing.json`)).default,
    NotFound: (await import(`./messages/${locale}/NotFound.json`)).default,

    // 【新增】你的功能翻译
    FeatureName: (await import(`./messages/${locale}/FeatureName.json`)).default,

    // Dashboard - User
    Settings: (await import(`./messages/${locale}/Dashboard/User/Settings.json`)).default,
    // ...其他配置
  }
}
```

#### 3. 在组件中使用翻译

**客户端组件 (Client Components):**
```typescript
'use client'

import { useTranslations } from 'next-intl'

export function MyComponent() {
  const t = useTranslations('FeatureName')

  return <div>{t('keyName')}</div>
}
```

**服务端组件 (Server Components):**
```typescript
import { getTranslations } from 'next-intl/server'

export async function MyServerComponent() {
  const t = await getTranslations('FeatureName')

  return <div>{t('keyName')}</div>
}
```

### 常见错误排查

#### 问题：翻译不显示或显示为键名
**原因**：忘记在 `i18n/request.ts` 中导入翻译文件

**解决方案**：
1. 检查 `i18n/request.ts` 的 `messages` 对象
2. 确保对应的翻译文件已正确导入
3. 重启开发服务器使配置生效

#### 问题：部分语言缺失翻译
**原因**：未为所有支持的语言创建翻译文件

**解决方案**：
1. 确保 `zh`、`en`、`ja` 三种语言的翻译文件都存在
2. 每个文件中的键（key）必须一致

### 最佳实践

1. **翻译键命名规范**：使用驼峰命名，语义清晰
   - ✅ `currentPrice`, `updateTime`, `loadError`
   - ❌ `cp`, `time`, `err`

2. **组织结构**：按功能模块组织翻译文件
   - 顶层功能：`i18n/messages/{locale}/FeatureName.json`
   - Dashboard功能：`i18n/messages/{locale}/Dashboard/User/FeatureName.json`

3. **插值（Interpolation）**：动态值使用插值而非字符串拼接
   ```typescript
   // ✅ 正确
   t('greeting', { name: user.name })

   // ❌ 错误
   `${t('hello')} ${user.name}`
   ```

4. **提交检查清单**：
   - [ ] 已创建所有语言的翻译文件（zh/en/ja）
   - [ ] 已在 `i18n/request.ts` 中添加导入
   - [ ] 所有翻译键在三种语言中保持一致
   - [ ] 已测试切换语言功能正常

---

## 实际案例：StockRealtime 功能

### 问题描述
实现股票实时行情弹窗后，发现多语言无法显示。

### 问题定位
1. ✅ 翻译文件已创建：`i18n/messages/{zh,en,ja}/StockRealtime.json`
2. ✅ 组件中正确使用：`const t = useTranslations('StockRealtime')`
3. ❌ **遗忘关键步骤**：未在 `i18n/request.ts` 中导入

### 解决方案
在 `i18n/request.ts` 的第18行添加：
```typescript
StockRealtime: (await import(`./messages/${locale}/StockRealtime.json`)).default,
```

### 经验教训
**每次添加新的翻译文件时，必须同步更新 `i18n/request.ts` 配置！**
