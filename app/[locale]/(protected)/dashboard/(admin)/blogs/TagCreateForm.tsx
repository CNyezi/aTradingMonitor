"use client";

import { createTagAction } from "@/actions/blogs/tags";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag } from "@/types/blog";
import { Loader2, PlusCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

interface TagCreateFormProps {
  existingTags: Tag[];
  onTagCreated: (tag: Tag) => void;
  disabled?: boolean;
}

export function TagCreateForm({
  existingTags,
  onTagCreated,
  disabled = false,
}: TagCreateFormProps) {
  const locale = useLocale();
  const t = useTranslations("DashboardBlogs.TagManager");

  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState("");

  const handleCreateTag = async () => {
    const trimmedName = newTagName.trim();

    if (!trimmedName) {
      toast.info(t("errors.nameRequired"));
      return;
    }

    if (
      existingTags.some(
        (tag) => tag.name.toLowerCase() === trimmedName.toLowerCase()
      )
    ) {
      toast.info(t("errors.alreadyExists", { name: trimmedName }));
      return;
    }

    setIsCreating(true);
    try {
      const result = await createTagAction({
        name: trimmedName,
        locale,
      });
      if (result.success && result.data?.tag) {
        toast.success(t("createSuccess", { name: result.data.tag.name }));
        onTagCreated(result.data.tag);
        setNewTagName("");
      } else {
        toast.error(t("errors.createFailed"), { description: result.error });
      }
    } catch (error) {
      toast.error("Failed to create tag.");
      console.error("Failed to create tag:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        placeholder={t("newTagPlaceholder")}
        value={newTagName}
        onChange={(e) => setNewTagName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !isCreating) {
            handleCreateTag();
          }
        }}
        disabled={isCreating || disabled}
      />
      <Button
        type="button"
        size="icon"
        onClick={handleCreateTag}
        disabled={isCreating || !newTagName.trim() || disabled}
      >
        {isCreating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <PlusCircle className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
