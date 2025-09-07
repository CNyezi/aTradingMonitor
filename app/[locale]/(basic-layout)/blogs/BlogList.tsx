"use client";

import { listPublishedPostsAction, PublicPost } from "@/actions/blogs/posts";
import { BlogPost, Tag } from "@/types/blog";
import dayjs from "dayjs";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import { toast } from "sonner";
import { BlogCard } from "./BlogCard";
import { TagSelector } from "./TagSelector";

function mapServerPostToBlogCard(post: PublicPost, locale: string): BlogPost {
  return {
    locale: locale,
    title: post.title,
    description: post.description ?? "",
    featured_image_url: post.featured_image_url ?? "/placeholder.svg",
    slug: post.slug,
    tags: post.tags ?? "",
    published_at:
      (post.published_at && dayjs(post.published_at).toDate()) || new Date(),
    status: post.status ?? "published",
    visibility: post.visibility ?? "public",
    is_pinned: post.is_pinned ?? false,
    content: "", // content is not used in the blog card
  };
}

interface BlogListProps {
  localPosts: BlogPost[];
  initialPosts: PublicPost[];
  initialTotal: number;
  serverTags: Tag[];
  locale: string;
  pageSize: number;
}

export function BlogList({
  localPosts,
  initialPosts,
  initialTotal,
  serverTags,
  locale,
  pageSize,
}: BlogListProps) {
  const t = useTranslations("Blogs");

  const [posts, setPosts] = useState<PublicPost[]>(initialPosts);
  const [pageIndex, setPageIndex] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(
    initialPosts.length < initialTotal
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const { ref, inView } = useInView({
    threshold: 0,
    triggerOnce: false,
  });

  const loadMorePosts = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    const result = await listPublishedPostsAction({
      pageIndex: pageIndex,
      pageSize: pageSize,
      locale: locale,
      tagId: selectedTagId,
    });

    if (result.success && result.data?.posts) {
      const newPosts = result.data.posts;
      const newTotal = result.data.count ?? initialTotal;
      setPosts((prevPosts) => [...prevPosts, ...newPosts]);
      setPageIndex((prevIndex) => prevIndex + 1);
      setHasMore(posts.length + newPosts.length < newTotal);
    } else {
      console.error("Failed to load more posts:", result.error);
      toast.error(t("loadMorePostsFailed"), {
        description: result.error,
      });
    }
    setIsLoading(false);
  }, [
    pageIndex,
    locale,
    isLoading,
    hasMore,
    initialTotal,
    posts.length,
    selectedTagId,
  ]);

  useEffect(() => {
    if (inView && hasMore && !isLoading) {
      loadMorePosts();
    }
  }, [inView, hasMore, isLoading, loadMorePosts]);

  useEffect(() => {
    setPosts(initialPosts);
    setPageIndex(1);
    setHasMore(initialPosts.length < initialTotal);
  }, [initialPosts, initialTotal]);

  const handleTagSelect = async (tagId: string | null) => {
    if (tagId === selectedTagId) return;

    setSelectedTagId(tagId);
    setIsLoading(true);

    const result = await listPublishedPostsAction({
      pageIndex: 0,
      pageSize: pageSize,
      locale: locale,
      tagId: tagId,
    });

    if (result.success && result.data?.posts) {
      setPosts(result.data.posts);
      setPageIndex(1);
      setHasMore(result.data.posts.length < (result.data.count ?? 0));
    } else {
      console.error("Failed to filter posts by tag:", result.error);
      toast.error(t("filterPostsFailed"), {
        description: result.error,
      });
    }

    setIsLoading(false);
  };

  return (
    <>
      {serverTags.length > 0 && (
        <TagSelector
          tags={serverTags}
          selectedTagId={selectedTagId}
          onSelectTag={handleTagSelect}
        />
      )}

      {isLoading && pageIndex === 1 ? (
        <div className="flex justify-center items-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {selectedTagId === null &&
              localPosts.map((post) => (
                <BlogCard
                  key={`local-${post.slug}`}
                  locale={locale}
                  post={post}
                />
              ))}

            {posts.map((post) => (
              <BlogCard
                key={`server-${post.id}`}
                locale={locale}
                post={mapServerPostToBlogCard(post, locale)}
              />
            ))}
          </div>

          {hasMore && (
            <div ref={ref} className="flex justify-center items-center py-8">
              {isLoading ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              ) : (
                <span className="text-gray-500">{t("loadMorePosts")}</span>
              )}
            </div>
          )}

          {!hasMore && posts.length >= 0 && (
            <p className="text-center text-gray-500 py-8 text-sm">
              {posts.length === 0
                ? t("noPostsFoundForThisTag")
                : t("reachedTheEnd")}
            </p>
          )}
        </>
      )}
    </>
  );
}
