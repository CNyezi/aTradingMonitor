"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { user as userSchema } from "@/drizzle/db/schema";
import { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

type UserType = typeof userSchema.$inferSelect;

export const columns: ColumnDef<UserType>[] = [
  {
    accessorKey: "image",
    header: "Avatar",
    cell: ({ row }) => {
      const image = row.original.image;
      const name = row.original.name || row.original.email;
      return (
        <Avatar>
          <AvatarImage src={image || undefined} alt={name} />
          <AvatarFallback>{name[0].toUpperCase()}</AvatarFallback>
        </Avatar>
      );
    },
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => (
      <span
        className="cursor-pointer"
        onClick={() => {
          navigator.clipboard.writeText(row.original.email);
          toast.success("Copied to clipboard");
        }}
      >
        {row.original.email}
      </span>
    ),
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => row.original.name || "-",
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => (
      <span
        className={`capitalize ${
          row.original.role === "admin" ? "text-primary font-medium" : ""
        }`}
      >
        {row.original.role}
      </span>
    ),
  },
  {
    accessorKey: "stripeCustomerId",
    header: "Stripe Customer ID",
    cell: ({ row }) => (
      <span
        className="cursor-pointer"
        onClick={() => {
          navigator.clipboard.writeText(row.original.stripeCustomerId || "");
          toast.success("Copied to clipboard");
        }}
      >
        {row.original.stripeCustomerId || "-"}
      </span>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Joined",
    cell: ({ row }) => dayjs(row.original.createdAt).format("YYYY-MM-DD HH:mm"),
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => {
      const user = row.original;

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
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(user.id)}
            >
              Copy user ID
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(user.email)}
            >
              Copy email
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                navigator.clipboard.writeText(user.stripeCustomerId || "")
              }
            >
              Copy Stripe Customer ID
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
