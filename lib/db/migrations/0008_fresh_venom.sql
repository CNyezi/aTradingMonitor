CREATE TYPE "public"."alert_type" AS ENUM('price_change', 'volume_spike', 'limit_up', 'limit_down', 'price_breakout');--> statement-breakpoint
CREATE TYPE "public"."monitor_rule_type" AS ENUM('price_change', 'volume_spike', 'limit_up', 'limit_down', 'price_breakout');--> statement-breakpoint
CREATE TABLE "stock_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stock_id" uuid NOT NULL,
	"rule_id" uuid,
	"alert_type" "alert_type" NOT NULL,
	"trigger_time" timestamp with time zone DEFAULT now() NOT NULL,
	"trigger_data" jsonb NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"notified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_monitor_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stock_id" uuid NOT NULL,
	"rule_type" "monitor_rule_type" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_price_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stock_id" uuid NOT NULL,
	"snapshot_time" timestamp with time zone NOT NULL,
	"open" numeric(10, 2),
	"high" numeric(10, 2),
	"low" numeric(10, 2),
	"close" numeric(10, 2) NOT NULL,
	"volume" numeric(20, 2),
	"amount" numeric(20, 2),
	"change_pct" numeric(10, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_notification_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"webhook_url" text,
	"webhook_enabled" boolean DEFAULT false NOT NULL,
	"browser_push_enabled" boolean DEFAULT false NOT NULL,
	"push_subscription" jsonb,
	"quiet_hours_start" varchar(5),
	"quiet_hours_end" varchar(5),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_notification_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_stock_id_stocks_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."stocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_rule_id_stock_monitor_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."stock_monitor_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_monitor_rules" ADD CONSTRAINT "stock_monitor_rules_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_monitor_rules" ADD CONSTRAINT "stock_monitor_rules_stock_id_stocks_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."stocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_price_snapshots" ADD CONSTRAINT "stock_price_snapshots_stock_id_stocks_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."stocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification_settings" ADD CONSTRAINT "user_notification_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_stock_alerts_user_id" ON "stock_alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_stock_alerts_stock_id" ON "stock_alerts" USING btree ("stock_id");--> statement-breakpoint
CREATE INDEX "idx_stock_alerts_read" ON "stock_alerts" USING btree ("read");--> statement-breakpoint
CREATE INDEX "idx_stock_alerts_trigger_time" ON "stock_alerts" USING btree ("trigger_time");--> statement-breakpoint
CREATE INDEX "idx_stock_monitor_rules_user_id" ON "stock_monitor_rules" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_stock_monitor_rules_stock_id" ON "stock_monitor_rules" USING btree ("stock_id");--> statement-breakpoint
CREATE INDEX "idx_stock_monitor_rules_enabled" ON "stock_monitor_rules" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "idx_stock_price_snapshots_stock_time" ON "stock_price_snapshots" USING btree ("stock_id","snapshot_time");--> statement-breakpoint
CREATE INDEX "idx_stock_price_snapshots_time" ON "stock_price_snapshots" USING btree ("snapshot_time");