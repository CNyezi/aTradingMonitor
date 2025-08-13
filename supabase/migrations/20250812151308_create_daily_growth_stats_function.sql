-- This function retrieves daily counts of new users and new orders within a specified date range.
-- It is designed to efficiently generate time-series data for analytics charts, such as a growth overview.
--
-- Parameters:
--   start_date_param (text): The beginning of the date range (inclusive), in a format convertible to a timestamp.
--
-- Returns:
--   A table with three columns:
--   - report_date (date): A date within the specified range.
--   - new_users_count (integer): The number of users who registered on that specific date.
--   - new_orders_count (integer): The number of 'succeeded' or 'active' orders created on that date.

CREATE OR REPLACE FUNCTION get_daily_growth_stats(start_date_param text)
RETURNS TABLE(report_date date, new_users_count integer, new_orders_count integer)
LANGUAGE sql
AS $$
  WITH date_series AS (
    SELECT generate_series(
      start_date_param::date,
      CURRENT_DATE,
      '1 day'::interval
    )::date AS report_date
  ),
  daily_users AS (
    SELECT
      created_at::date AS report_date,
      COUNT(id) AS new_users_count
    FROM users
    WHERE created_at >= start_date_param::timestamptz
    GROUP BY 1
  ),
  daily_orders AS (
    SELECT
      created_at::date AS report_date,
      COUNT(id) AS new_orders_count
    FROM orders
    WHERE
      created_at >= start_date_param::timestamptz AND
      status IN ('succeeded', 'active')
    GROUP BY 1
  )
  SELECT
    d.report_date,
    COALESCE(u.new_users_count, 0)::integer AS new_users_count,
    COALESCE(o.new_orders_count, 0)::integer AS new_orders_count
  FROM date_series d
  LEFT JOIN daily_users u ON d.report_date = u.report_date
  LEFT JOIN daily_orders o ON d.report_date = o.report_date
  ORDER BY d.report_date ASC;
$$; 