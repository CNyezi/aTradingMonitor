-- 添加股票监控规则关联表
-- 实现股票与规则的多对多关系，允许每只股票独立选择要应用的规则

CREATE TABLE IF NOT EXISTS "stock_monitor_rule_associations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"watched_stock_id" uuid NOT NULL,
	"rule_id" uuid NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- 添加外键约束
ALTER TABLE "stock_monitor_rule_associations"
  ADD CONSTRAINT "stock_monitor_rule_associations_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE CASCADE;

ALTER TABLE "stock_monitor_rule_associations"
  ADD CONSTRAINT "stock_monitor_rule_associations_watched_stock_id_user_watched_stocks_id_fk"
  FOREIGN KEY ("watched_stock_id") REFERENCES "public"."user_watched_stocks"("id") ON DELETE CASCADE;

ALTER TABLE "stock_monitor_rule_associations"
  ADD CONSTRAINT "stock_monitor_rule_associations_rule_id_stock_monitor_rules_id_fk"
  FOREIGN KEY ("rule_id") REFERENCES "public"."stock_monitor_rules"("id") ON DELETE CASCADE;

-- 添加唯一索引，确保股票和规则的组合唯一
CREATE UNIQUE INDEX IF NOT EXISTS "unique_stock_rule"
  ON "stock_monitor_rule_associations" ("watched_stock_id", "rule_id");

-- 添加其他索引以提高查询性能
CREATE INDEX IF NOT EXISTS "associations_user_id_idx"
  ON "stock_monitor_rule_associations" ("user_id");

CREATE INDEX IF NOT EXISTS "associations_watched_stock_id_idx"
  ON "stock_monitor_rule_associations" ("watched_stock_id");

CREATE INDEX IF NOT EXISTS "associations_rule_id_idx"
  ON "stock_monitor_rule_associations" ("rule_id");