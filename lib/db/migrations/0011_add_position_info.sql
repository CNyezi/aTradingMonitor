-- Add cost_price and quantity columns to user_watched_stocks table
ALTER TABLE "user_watched_stocks" ADD COLUMN "cost_price" numeric(10, 2);
ALTER TABLE "user_watched_stocks" ADD COLUMN "quantity" integer;
