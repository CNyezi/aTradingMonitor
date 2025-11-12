# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **股票实时监控系统** (Stock Real-time Monitoring System) built on the Nexty.dev SaaS boilerplate. It combines Next.js 15 + React 19 with custom WebSocket infrastructure for real-time A-share stock monitoring.

**Base Framework**: Nexty.dev (https://nexty.dev)
**Framework Docs**: https://context7.com/websites/nexty_dev/llms.txt?tokens=10000
**Cursor Rules**: See `.cursor/rules/` directory for detailed guidelines

## Core Architecture

### Dual-Server Setup
The application runs **two separate servers**:

1. **Next.js App Server** (Port 3000)
   - Standard Next.js App Router
   - Server Components, API Routes, Server Actions
   - Authentication, UI rendering, business logic

2. **WebSocket Server** (Port 3333)
   - Standalone Node.js process (`server/websocket-server.ts`)
   - Real-time stock data streaming
   - Session-based authentication using Better Auth tokens
   - Intelligent push frequency (1s trading hours, 60s off-hours)

### Key Components

**WebSocket Architecture** (`server/`):
- `websocket-server.ts`: Main WS server with connection lifecycle
- `managers/connection-manager.ts`: Client connection tracking
- `managers/subscription-manager.ts`: Stock subscription management
- `services/stock-data-service.ts`: Fetches from Sina Finance API, auto-adjusts frequency based on trading hours
- `services/message-router.ts`: Handles subscribe/unsubscribe messages
- `types.ts`: WebSocket message and quote types

**Stock Monitoring** (`lib/monitors/`):
- `check-rules.ts`: Rule validation engine (price change, volume spike, limit up/down, breakout)
- `realtime-check.ts`: Real-time alert checker coordinating rule evaluation
- `types.ts`: MonitorRule, AlertEvent type definitions
- `preset-rules.ts`: Pre-defined monitoring templates
- `intraday-history-manager.ts`: In-memory intraday data cache for volume calculations
- `time-window-manager.ts`: Manages time-based alert suppression

**Database Schema** (Drizzle + PostgreSQL):
- `user_watched_stocks`: User's stock list with `cost_price`, `quantity` for P/L tracking
- `stock_monitor_rules`: Custom monitoring rules (JSON config)
- `stock_monitor_rule_associations`: Many-to-many with `enabled` flag
- `stock_alerts`: Alert history with `acknowledged` state

**Real-time Data Flow**:
```
Sina Finance API → StockDataService → SubscriptionManager → ConnectionManager → WebSocket Clients
                                    ↓
                              RealtimeCheck → CheckRules → AlertEvent → Database + WS Broadcast
```

## Development Commands

### Starting Development

```bash
# Start Next.js app only
pnpm dev

# Start WebSocket server only
pnpm ws:dev

# Start both servers concurrently (RECOMMENDED)
pnpm dev:all
```

### Database Operations

```bash
# Generate migration from schema changes
pnpm db:generate

# Apply migrations to database
pnpm db:migrate

# Push schema directly (dev only)
pnpm db:push

# Open Drizzle Studio
pnpm db:studio

# Seed database
pnpm db:seed
```

### Building & Deployment

```bash
# Build production bundle
pnpm build

# Start production server
pnpm start

# Analyze bundle size
pnpm analyze

# Lint code
pnpm lint
```

## Critical Implementation Rules

### 1. Internationalization (i18n)

**CRITICAL**: When adding new translatable content, you **MUST** follow this exact 3-step process:

#### Step 1: Create translation files for ALL locales
```
i18n/messages/
  ├── zh/YourFeature.json
  ├── en/YourFeature.json
  └── ja/YourFeature.json
```

#### Step 2: Update `i18n/request.ts` (MOST COMMONLY FORGOTTEN)
```typescript
export default getRequestConfig(async ({ requestLocale }) => {
  // ...
  return {
    locale,
    messages: {
      // ... existing imports ...
      YourFeature: (await import(`./messages/${locale}/YourFeature.json`)).default, // ADD THIS
    }
  }
})
```

#### Step 3: Use in components
```typescript
// Client Component
const t = useTranslations('YourFeature')

// Server Component
const t = await getTranslations('YourFeature')
```

**Common Error**: Translation keys display as raw strings → Forgot Step 2

### 2. WebSocket Integration

**Authentication**: WebSocket uses session tokens from Better Auth:
```typescript
// Client-side connection
const session = await authClient.getSession()
const ws = new WebSocket(`ws://localhost:3333?token=${session.token}`)
```

**Message Protocol**:
```typescript
// Subscribe to stocks
ws.send(JSON.stringify({
  type: 'subscribe',
  payload: { stocks: ['000001.SZ', '600000.SH'] }
}))

// Receive updates
ws.onmessage = (event) => {
  const { type, payload } = JSON.parse(event.data)
  // type: 'stock_update' | 'alert' | 'error'
}
```

**Trading Hours Logic**: `StockDataService` automatically switches between:
- Trading hours (Mon-Fri 9:30-11:30, 13:00-15:00): 1 second interval
- Non-trading hours: 60 second interval

### 3. Database Migrations

**DO NOT** create custom scripts to run migrations. Always use:
```bash
pnpm db:generate  # After schema changes
pnpm db:migrate   # Apply to database
```

The system tracks migrations in `lib/db/migrations/meta/_journal.json`. Manual SQL execution will cause tracking issues.

### 4. Stock Data Provider

**Primary**: Sina Finance API (新浪财经)
- No API key required
- Real-time quotes via `https://hq.sinajs.cn/list=<symbols>`
- Code format: `sh600000` (Shanghai), `sz000001` (Shenzhen), `bj430017` (Beijing)

**Tushare API** (备用):
- Requires token in `.env.local`: `TUSHARE_TOKEN`
- Used for historical data and stock info lookup
- Rate limited, use sparingly

### 5. Git Workflow

This project tracks two remotes:
```bash
origin   → https://github.com/CNyezi/aTradingMonitor.git (Your project)
upstream → https://github.com/WeNextDev/nexty.dev.git (Base framework)
```

To sync framework updates:
```bash
git fetch upstream
git merge upstream/main
git push origin main
```

### 6. Server Actions

All business logic mutations should use Server Actions in `actions/`:
- `actions/stocks.ts`: Stock watchlist CRUD
- `actions/monitors.ts`: Monitor rules management
- `actions/alerts.ts`: Alert history operations

**Pattern**:
```typescript
'use server'

import { getSession } from '@/lib/auth/server'
import { db } from '@/lib/db'

export async function yourAction() {
  const { user } = await getSession()
  if (!user) return { success: false, error: 'Unauthorized' }

  // Business logic here
  return { success: true, data: result }
}
```

### 7. UI Components

**Table Components** (using @tanstack/react-table):
- `components/stocks/table/`: Complete table implementation
- Features: sorting, filtering, column pinning, responsive hiding
- Always include `isAmountVisible` prop for privacy control

**Real-time Components**:
- Use `useWebSocket` hook for connection management
- Subscribe to relevant stocks in `useEffect`
- Handle disconnection gracefully with reconnection logic

## Project-Specific Patterns

### Stock Code Format
- **Tushare**: `000001.SZ`, `600000.SH`, `430017.BJ`
- **Sina Finance**: `sz000001`, `sh600000`, `bj430017`
- Always convert when switching between APIs

### Monitor Rule Config Structure
```typescript
{
  ruleType: 'price_change' | 'volume_spike' | 'limit_up' | 'limit_down' | 'price_breakout',
  config: {
    // Type-specific fields
    priceChangeThreshold?: number    // For price_change
    volumeMultiplier?: number         // For volume_spike
    volumePeriod?: number             // For volume_spike
    limitThreshold?: number           // For limit_up/down
    breakoutPrice?: number            // For price_breakout
    breakoutDirection?: 'up' | 'down' // For price_breakout
  }
}
```

### Alert Suppression
Use `TimeWindowManager` to prevent alert spam:
```typescript
const canTrigger = timeWindowManager.canTriggerAlert(
  stockId,
  ruleType,
  windowMinutes
)
```

## Environment Variables

Required in `.env.local`:
```bash
# Database
DATABASE_URL="postgresql://..."

# Auth
BETTER_AUTH_SECRET="..."

# Stock Data
TUSHARE_TOKEN="..."  # For historical data

# WebSocket
WS_PORT=3333
NEXT_PUBLIC_WS_HOST=localhost
NEXT_PUBLIC_WS_PORT=3333
```

## Testing Real-time Features

1. Start both servers: `pnpm dev:all`
2. Login to get session token
3. Open browser DevTools → Network → WS
4. Verify WebSocket connection at `ws://localhost:3333`
5. Check messages for `stock_update` events
6. During trading hours, updates should be ~1s apart
7. During off-hours, updates should be ~60s apart

## Important Notes

- **Never commit** `.env.local` or any files with secrets
- WebSocket server authenticates via Better Auth session table lookup
- All monetary amounts should support privacy toggle (eye icon)
- Stock prices use 2 decimal precision, percentages use 2 decimals
- Alert timestamps are stored in UTC, display in user's timezone
- Monitor rules are user-scoped, not global

## Framework Documentation

This project builds on Nexty.dev. For framework-specific questions:
- Visit: https://context7.com/websites/nexty_dev/llms.txt?tokens=10000
- Check: `.cursor/rules/` directory for detailed guidelines on Next.js, React, Tailwind, Better Auth, Drizzle, etc.
