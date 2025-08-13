-- This SQL function aggregates order statistics for a given period,
-- improving performance by processing data within the database.
-- It categorizes orders into one-time, monthly, and yearly,
-- calculating both the count and total revenue for each category.
-- The results are returned as a single JSON object for easy handling in the application.

CREATE OR REPLACE FUNCTION get_order_stats_for_period(
  start_date_param text,
  end_date_param text
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'oneTime', json_build_object(
      'count', COUNT(*) FILTER (WHERE o.order_type = 'one_time_purchase'),
      'revenue', COALESCE(SUM(o.amount_total) FILTER (WHERE o.order_type = 'one_time_purchase'), 0)
    ),
    'monthly', json_build_object(
      'count', COUNT(*) FILTER (WHERE o.order_type IN ('subscription_initial', 'subscription_renewal') AND pp.recurring_interval = 'month'),
      'revenue', COALESCE(SUM(o.amount_total) FILTER (WHERE o.order_type IN ('subscription_initial', 'subscription_renewal') AND pp.recurring_interval = 'month'), 0)
    ),
    'yearly', json_build_object(
      'count', COUNT(*) FILTER (WHERE o.order_type IN ('subscription_initial', 'subscription_renewal') AND pp.recurring_interval = 'year'),
      'revenue', COALESCE(SUM(o.amount_total) FILTER (WHERE o.order_type IN ('subscription_initial', 'subscription_renewal') AND pp.recurring_interval = 'year'), 0)
    )
  )
  INTO result
  FROM orders AS o
  LEFT JOIN pricing_plans AS pp ON o.plan_id = pp.id
  WHERE
    o.created_at >= start_date_param::timestamptz AND
    o.created_at < end_date_param::timestamptz AND
    o.status IN ('succeeded', 'active');

  RETURN result;
END;
$$; 