"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { Copy, Download, MoreHorizontal, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import { R2File } from "./actions";

const getFileType = (key: string): "image" | "video" | "other" => {
  const lowerKey = key.toLowerCase();
  if (lowerKey.includes("image-to-videos/")) return "video";
  if (
    lowerKey.endsWith(".png") ||
    lowerKey.endsWith(".jpg") ||
    lowerKey.endsWith(".jpeg") ||
    lowerKey.endsWith(".webp") ||
    lowerKey.endsWith(".gif")
  ) {
    return "image";
  }
  if (
    lowerKey.endsWith(".mp4") ||
    lowerKey.endsWith(".webm") ||
    lowerKey.endsWith(".mov")
  ) {
    return "video";
  }
  return "other";
};

const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

interface ActionsCellProps {
  file: R2File;
  r2PublicUrl?: string;
  onDelete: (key: string) => void;
}

const ActionsCell: React.FC<ActionsCellProps> = ({
  file,
  r2PublicUrl,
  onDelete,
}) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(file.key);
    toast.success("Filename copied to clipboard");
  };

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
        <DropdownMenuItem onClick={handleCopy}>
          <Copy className="mr-2 h-4 w-4" />
          Copy Filename (Key)
        </DropdownMenuItem>
        {r2PublicUrl ? (
          <DropdownMenuItem asChild>
            <a
              href={`${r2PublicUrl}/${file.key}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center w-full"
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </a>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled>
            <Download className="mr-2 h-4 w-4 opacity-50" />
            Download Unavailable
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() => onDelete(file.key)}
          className="text-destructive focus:text-destructive focus:bg-destructive/10"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const getColumns = (
  r2PublicUrl: string | undefined,
  onDelete: (key: string) => void
): ColumnDef<R2File>[] => [
  {
    accessorKey: "preview",
    header: "Preview",
    cell: ({ row }) => {
      const file = row.original;
      const fileType = getFileType(file.key);
      const previewUrl = r2PublicUrl ? `${r2PublicUrl}/${file.key}` : undefined;

      if (!previewUrl)
        return <span className="text-xs text-muted-foreground">N/A</span>;

      if (fileType === "image") {
        return (
          <img
            src={previewUrl}
            alt={`Preview of ${file.key}`}
            width={64}
            height={64}
            className="object-contain rounded border bg-muted"
            // Optional: Add error handling or placeholder
          />
        );
      } else if (fileType === "video") {
        return (
          <video
            src={previewUrl}
            width="80"
            height="64"
            controls={false}
            muted
            preload="metadata"
            className="rounded border bg-muted"
          >
            <Video className="h-8 w-8 text-muted-foreground" />
          </video>
        );
      } else {
        return (
          <span className="text-xs text-muted-foreground">No Preview</span>
        );
      }
    },
    enableSorting: false,
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => row.original.type.toUpperCase() ?? "Unknown",
  },
  {
    accessorKey: "size",
    header: "Size",
    cell: ({ row }) => formatBytes(row.getValue<number>("size")),
  },
  {
    accessorKey: "lastModified",
    header: "Last Modified",
    cell: ({ row }) => {
      const date = row.getValue<Date>("lastModified");
      return dayjs(date).format("YYYY-MM-DD HH:mm:ss");
    },
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <ActionsCell
        file={row.original}
        r2PublicUrl={r2PublicUrl}
        onDelete={onDelete}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
];
