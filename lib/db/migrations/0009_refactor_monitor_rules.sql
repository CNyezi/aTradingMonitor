-- 重构监控规则：规则与股票分离管理
-- 1. 给 user_watched_stocks 添加 monitored 字段
ALTER TABLE "user_watched_stocks" ADD COLUMN "monitored" boolean DEFAULT false NOT NULL;

-- 2. 修改 stock_monitor_rules 表结构
-- 删除 stock_id 相关的外键和索引
ALTER TABLE "stock_monitor_rules" DROP CONSTRAINT IF EXISTS "stock_monitor_rules_stock_id_stocks_id_fk";
DROP INDEX IF EXISTS "idx_stock_monitor_rules_stock_id";

-- 删除 stock_id 列
ALTER TABLE "stock_monitor_rules" DROP COLUMN IF EXISTS "stock_id";

-- 添加 rule_name 列
ALTER TABLE "stock_monitor_rules" ADD COLUMN "rule_name" varchar(100);

-- 添加新索引
CREATE INDEX IF NOT EXISTS "idx_stock_monitor_rules_rule_type" ON "stock_monitor_rules" ("rule_type");

-- 3. 修改 stock_alerts 表，移除 rule_id（告警与规则类型关联，不与具体规则关联）
ALTER TABLE "stock_alerts" DROP CONSTRAINT IF EXISTS "stock_alerts_rule_id_stock_monitor_rules_id_fk";
ALTER TABLE "stock_alerts" DROP COLUMN IF EXISTS "rule_id";
