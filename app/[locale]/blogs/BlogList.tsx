"use client";

import { listPublishedPostsAction, PublicPost } from "@/actions/blogs/posts";
import { BlogCard } from "@/app/[locale]/blogs/BlogCard";
import { BlogPost } from "@/types/blog";
import dayjs from "dayjs";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import { toast } from "sonner";

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
    is_pinned: post.is_pinned ?? false,
    content: "", // content is not used in the blog card
  };
}

interface BlogListProps {
  localPosts: BlogPost[];
  initialPosts: PublicPost[];
  initialTotal: number;
  locale: string;
  pageSize: number;
}

export function BlogList({
  localPosts,
  initialPosts,
  initialTotal,
  locale,
  pageSize,
}: BlogListProps) {
  const [posts, setPosts] = useState<PublicPost[]>(initialPosts);
  const [pageIndex, setPageIndex] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(
    initialPosts.length < initialTotal
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
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
    });

    if (result.success && result.data?.posts) {
      const newPosts = result.data.posts;
      const newTotal = result.data.count ?? initialTotal;
      setPosts((prevPosts) => [...prevPosts, ...newPosts]);
      setPageIndex((prevIndex) => prevIndex + 1);
      setHasMore(posts.length + newPosts.length < newTotal);
    } else {
      console.error("Failed to load more posts:", result.error);
      toast.error("Failed to load more posts", {
        description: result.error,
      });
    }
    setIsLoading(false);
  }, [
    pageIndex,
    pageSize,
    locale,
    isLoading,
    hasMore,
    initialTotal,
    posts.length,
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

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {localPosts.map((post) => (
          <BlogCard key={`local-${post.slug}`} locale={locale} post={post} />
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
            <span className="text-gray-500">Loading more...</span>
          )}
        </div>
      )}

      {!hasMore && posts.length >= initialTotal && posts.length > 0 && (
        <p className="text-center text-gray-500 py-8">
          You've reached the end!
        </p>
      )}
    </>
  );
}
