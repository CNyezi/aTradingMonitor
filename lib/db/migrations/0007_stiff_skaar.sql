CREATE TABLE "stocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ts_code" varchar(20) NOT NULL,
	"symbol" varchar(10) NOT NULL,
	"name" varchar(100) NOT NULL,
	"area" varchar(50),
	"industry" varchar(50),
	"market" varchar(20),
	"list_date" varchar(10),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stocks_ts_code_unique" UNIQUE("ts_code")
);
--> statement-breakpoint
CREATE TABLE "user_stock_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_stock_groups_user_id_name_unique" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "user_watched_stocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stock_id" uuid NOT NULL,
	"group_id" uuid,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_watched_stocks_user_id_stock_id_unique" UNIQUE("user_id","stock_id")
);
--> statement-breakpoint
ALTER TABLE "user_stock_groups" ADD CONSTRAINT "user_stock_groups_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_watched_stocks" ADD CONSTRAINT "user_watched_stocks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_watched_stocks" ADD CONSTRAINT "user_watched_stocks_stock_id_stocks_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."stocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_watched_stocks" ADD CONSTRAINT "user_watched_stocks_group_id_user_stock_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."user_stock_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_stocks_ts_code" ON "stocks" USING btree ("ts_code");--> statement-breakpoint
CREATE INDEX "idx_stocks_name" ON "stocks" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_stocks_symbol" ON "stocks" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_user_stock_groups_user_id" ON "user_stock_groups" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_watched_stocks_user_id" ON "user_watched_stocks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_watched_stocks_stock_id" ON "user_watched_stocks" USING btree ("stock_id");--> statement-breakpoint
CREATE INDEX "idx_user_watched_stocks_group_id" ON "user_watched_stocks" USING btree ("group_id");