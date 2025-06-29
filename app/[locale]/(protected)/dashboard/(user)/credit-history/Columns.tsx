"use client";

import type { CreditLog } from "@/actions/usage/logs";
import { Badge } from "@/components/ui/badge";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";

const formatLogType = (type: string, t: (key: string) => string) => {
  switch (type) {
    case "one_time_purchase":
      return (
        <Badge variant="default" className="bg-green-500 hover:bg-green-600">
          {t("type_one_time_purchase")}
        </Badge>
      );
    case "subscription_grant":
      return (
        <Badge variant="default" className="bg-green-500 hover:bg-green-600">
          {t("type_subscription_grant")}
        </Badge>
      );
    case "feature_usage":
      return <Badge variant="secondary">{t("type_feature_usage")}</Badge>;
    case "refund_revoke":
      return <Badge variant="destructive">{t("type_refund_revoke")}</Badge>;
    case "subscription_cancel_revoke":
      return (
        <Badge variant="destructive">
          {t("type_subscription_cancel_revoke")}
        </Badge>
      );
    default:
      return <Badge variant="outline">{type}</Badge>;
  }
};

export const getColumns = (
  t: (key: string) => string
): ColumnDef<CreditLog>[] => [
  {
    accessorKey: "created_at",
    header: t("header_date"),
    cell: ({ row }) => (
      <div>
        {dayjs(row.getValue("created_at")).format("YYYY-MM-DD HH:mm:ss")}
      </div>
    ),
  },
  {
    accessorKey: "type",
    header: t("header_type"),
    cell: ({ row }) => formatLogType(row.getValue("type"), t),
  },
  {
    accessorKey: "notes",
    header: t("header_details"),
    cell: ({ row }) => (
      <div className="max-w-[200px] truncate">{row.getValue("notes")}</div>
    ),
  },
  {
    accessorKey: "amount",
    header: () => <div className="text-right">{t("header_amount")}</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("amount"));
      const formatted = amount > 0 ? `+${amount}` : amount.toString();
      return (
        <div
          className={`text-right font-medium ${
            amount > 0 ? "text-green-600" : "text-destructive"
          }`}
        >
          {formatted}
        </div>
      );
    },
  },
  {
    accessorKey: "one_time_balance_after",
    header: () => (
      <div className="text-right">{t("header_balance_one_time")}</div>
    ),
    cell: ({ row }) => (
      <div className="text-right text-muted-foreground">
        {row.getValue("one_time_balance_after")}
      </div>
    ),
  },
  {
    accessorKey: "subscription_balance_after",
    header: () => (
      <div className="text-right">{t("header_balance_subscription")}</div>
    ),
    cell: ({ row }) => (
      <div className="text-right text-muted-foreground">
        {row.getValue("subscription_balance_after")}
      </div>
    ),
  },
];
