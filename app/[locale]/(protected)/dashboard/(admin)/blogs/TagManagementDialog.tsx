"use client";

import {
  deleteTagAction,
  listTagsAction,
  updateTagAction,
} from "@/actions/blogs/tags";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tag, type Tag as DbTag } from "@/types/blog";
import { Check, Edit3, Loader2, Tags, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { TagCreateForm } from "./TagCreateForm";

export function TagManagementDialog() {
  const t = useTranslations("DashboardBlogs.TagManager");
  const locale = useLocale();

  const [isOpen, setIsOpen] = useState(false);
  const [tags, setTags] = useState<DbTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [newTagName, setNewTagName] = useState("");
  const [editingTag, setEditingTag] = useState<DbTag | null>(null);
  const [editingTagName, setEditingTagName] = useState("");

  const fetchTags = async () => {
    setIsLoading(true);
    try {
      const result = await listTagsAction({ locale });
      if (result.success && result.data?.tags) {
        setTags(result.data.tags.sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        toast.error(t("errors.fetchFailed"), {
          description: result.error,
        });
      }
    } catch (error) {
      toast.error(t("errors.fetchFailed"));
      console.error("Failed to fetch tags:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  const handleTagCreated = (tag: Tag) => {
    setTags((prev) =>
      [...prev, tag].sort((a, b) => a.name.localeCompare(b.name))
    );
  };

  const handleDeleteTag = (tagId: string, tagName: string) => {
    if (!window.confirm(t("confirmDelete", { name: tagName }))) {
      return;
    }
    startTransition(async () => {
      const result = await deleteTagAction({ id: tagId, locale });
      if (result.success) {
        toast.success(t("deleteSuccess", { name: tagName }));
        setTags((prev) => prev.filter((tag) => tag.id !== tagId));
      } else {
        toast.error(t("errors.deleteFailed", { name: tagName }), {
          description: result.error,
        });
      }
    });
  };

  const handleStartEdit = (tag: DbTag) => {
    setEditingTag(tag);
    setEditingTagName(tag.name);
  };

  const handleCancelEdit = () => {
    setEditingTag(null);
    setEditingTagName("");
  };

  const handleUpdateTag = async () => {
    if (!editingTag || !editingTagName.trim()) {
      toast.info(t("errors.nameRequired"));
      return;
    }
    if (
      tags.some(
        (tag) =>
          tag.id !== editingTag.id &&
          tag.name.toLowerCase() === editingTagName.trim().toLowerCase()
      )
    ) {
      toast.info(t("errors.alreadyExists", { name: editingTagName.trim() }));
      return;
    }

    startTransition(async () => {
      const result = await updateTagAction({
        id: editingTag.id,
        name: editingTagName.trim(),
        locale,
      });
      if (result.success && result.data?.tag) {
        toast.success(t("updateSuccess", { name: result.data.tag.name }));
        setTags((prev) =>
          prev
            .map((t) => (t.id === editingTag.id ? result.data!.tag! : t))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
        handleCancelEdit();
      } else {
        toast.error(t("errors.updateFailed"), {
          description: result.error,
        });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Tags className="mr-2 h-4 w-4" /> {t("manageTagsButton")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] flex flex-col max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-hidden">
          <div className="mt-1 mb-4 mx-1">
            <TagCreateForm
              existingTags={tags}
              onTagCreated={handleTagCreated}
              disabled={isPending}
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : tags.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              {t("noResults")}
            </p>
          ) : (
            <ScrollArea className="h-[calc(80vh-280px)]">
              <ul className="space-y-2 pr-4">
                {tags.map((tag) => (
                  <li
                    key={tag.id}
                    className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 transition-colors"
                  >
                    {editingTag?.id === tag.id ? (
                      <>
                        <Input
                          value={editingTagName}
                          onChange={(e) => setEditingTagName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !isPending) {
                              handleUpdateTag();
                            } else if (e.key === "Escape") {
                              handleCancelEdit();
                            }
                          }}
                          className="h-8"
                          disabled={isPending}
                          autoFocus
                        />
                        <div className="flex space-x-1 ml-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleUpdateTag}
                            disabled={isPending || !editingTagName.trim()}
                            className="h-8 w-8"
                          >
                            {isPending && editingTag?.id === tag.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4 text-green-600" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleCancelEdit}
                            disabled={isPending}
                            className="h-8 w-8"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-medium">{tag.name}</span>
                        <div className="flex space-x-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleStartEdit(tag)}
                            title={t("editButton")}
                            disabled={isPending}
                            className="h-8 w-8"
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteTag(tag.id, tag.name)}
                            title={t("deleteButton")}
                            disabled={isPending}
                            className="h-8 w-8"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            {t("closeButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
