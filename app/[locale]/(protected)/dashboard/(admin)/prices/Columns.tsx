import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Link as I18nLink } from "@/i18n/routing";
import { PricingPlan } from "@/types/pricing";
import { ColumnDef, TableMeta } from "@tanstack/react-table";
import { ArrowUpDown, ExternalLink, MoreHorizontal } from "lucide-react";

interface CustomTableMeta extends TableMeta<PricingPlan> {
  openDeleteDialog: (plan: PricingPlan) => void;
}

export const columns: ColumnDef<PricingPlan>[] = [
  {
    accessorKey: "environment",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Environment
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const environment = row.getValue("environment") as string;
      const variant = environment === "live" ? "default" : "secondary";
      return (
        <Badge variant={variant} className="capitalize">
          {environment}
        </Badge>
      );
    },
    enableSorting: true,
  },
  {
    accessorKey: "card_title",
    header: "Title",
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue("card_title")}</span>
    ),
  },
  {
    accessorKey: "stripe_price_id",
    header: "Stripe Price ID",
    cell: ({ row }) => {
      const priceId = row.getValue("stripe_price_id");
      const environment = row.original.environment;
      const stripeLink = priceId
        ? `https://dashboard.stripe.com/${
            environment === "live" ? "" : "test/"
          }prices/${priceId}`
        : null;

      return priceId ? (
        <div className="flex items-center space-x-1">
          <code className="text-xs">{priceId as string}</code>
          {stripeLink && (
            <a
              href={stripeLink}
              target="_blank"
              rel="noopener noreferrer"
              title="View on Stripe Dashboard"
            >
              <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
            </a>
          )}
        </div>
      ) : (
        <span className="text-muted-foreground">-</span>
      );
    },
  },
  {
    accessorKey: "payment_type",
    header: "Payment Type",
    cell: ({ row }) => {
      const paymentType = row.getValue("payment_type") as string | null;
      const interval = row.original.recurring_interval;
      if (paymentType === "recurring" && interval) {
        return (
          <span className="capitalize">
            {paymentType} ({interval})
          </span>
        );
      }
      return paymentType ? (
        <span className="capitalize">{paymentType}</span>
      ) : (
        <span className="text-muted-foreground">-</span>
      );
    },
  },
  {
    accessorKey: "price",
    header: "Price",
    cell: ({ row }) => {
      return (
        <div className="text-right font-medium">
          {row.original.display_price}
        </div>
      );
    },
    enableSorting: true,
  },
  {
    accessorKey: "display_order",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="text-center w-full justify-center"
        >
          Order
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      return <div className="text-center">{row.getValue("display_order")}</div>;
    },
    enableSorting: true,
    size: 50,
  },
  {
    accessorKey: "is_active",
    header: "Status",
    cell: ({ row }) => {
      const isActive = row.getValue("is_active") as boolean;
      return isActive ? (
        <Badge variant="default">Active</Badge>
      ) : (
        <Badge variant="destructive">Inactive</Badge>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "benefits_jsonb",
    header: "Benefits",
    cell: ({ row }) => {
      const benefits = row.getValue("benefits_jsonb") as object | null;
      const benefitsString = benefits ? JSON.stringify(benefits) : "-";
      const displayString =
        benefitsString.length > 20
          ? benefitsString.substring(0, 17) + "..."
          : benefitsString;

      return benefits && Object.keys(benefits).length > 0 ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <code className="text-xs">{displayString}</code>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <pre className="text-xs">{JSON.stringify(benefits, null, 2)}</pre>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <span className="text-muted-foreground">-</span>
      );
    },
    enableSorting: false,
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      const plan = row.original;
      const meta = table.options.meta as CustomTableMeta;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <I18nLink
                href={`/dashboard/prices/${plan.id}/edit`}
                title="Edit"
                prefetch={false}
              >
                Edit Plan
              </I18nLink>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(plan.id)}
            >
              Copy plan ID
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                plan.stripe_price_id &&
                navigator.clipboard.writeText(plan.stripe_price_id)
              }
              disabled={!plan.stripe_price_id}
            >
              Copy Stripe Price ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-700 focus:bg-red-100"
              onClick={() => meta.openDeleteDialog(plan)}
            >
              Delete Plan
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    enableSorting: false,
    enableHiding: false,
  },
];
