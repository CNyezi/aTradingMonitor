import { listPublishedPostsAction } from "@/actions/blogs/posts";
import MDXComponents from "@/components/mdx/MDXComponents";
import { Button } from "@/components/ui/button";
import { Link as I18nLink, Locale, LOCALES } from "@/i18n/routing";
import { getPostBySlug, getPosts } from "@/lib/getBlogs";
import { constructMetadata } from "@/lib/metadata";
import dayjs from "dayjs";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarIcon,
  LockIcon,
} from "lucide-react";
import { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { MDXRemote } from "next-mdx-remote-client/rsc";
import Image from "next/image";
import { notFound } from "next/navigation";

type Params = Promise<{
  locale: string;
  slug: string;
}>;

type MetadataProps = {
  params: Params;
};

export async function generateMetadata({
  params,
}: MetadataProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const { post, error } = await getPostBySlug(slug, locale);

  if (error || !post) {
    return constructMetadata({
      title: "404",
      description: "Page not found",
      noIndex:
        post?.visibility === "subscribers" || post?.visibility === "logged_in",
      locale: locale as Locale,
      path: `/blogs/${slug}`,
    });
  }

  const metadataPath = post.slug.startsWith("/") ? post.slug : `/${post.slug}`;
  const fullPath = `/blogs${metadataPath}`;

  return constructMetadata({
    page: "blogs",
    title: post.title,
    description: post.description,
    images: post.featured_image_url ? [post.featured_image_url] : [],
    locale: locale as Locale,
    path: fullPath,
    // canonicalUrl: fullPath,
  });
}

export default async function BlogPage({ params }: { params: Params }) {
  const t = await getTranslations("Blogs");
  const locale = await getLocale();

  const { slug } = await params;
  const {
    post,
    error: errorMessage,
    errorCode,
  } = await getPostBySlug(slug, locale);

  if (errorCode) {
    let messageTitle = t("BlogDetail.accessRestricted");
    let messageContent = errorMessage || "An error occurred.";
    let actionText = "";
    const redirectUrl = `/${locale}/blogs/${slug}`;
    let actionLink = `/login?next=${encodeURIComponent(redirectUrl)}`;

    if (errorCode === "unauthorized") {
      messageContent = t("BlogDetail.unauthorized");
      actionText = t("BlogDetail.signIn");
    } else if (errorCode === "notSubscriber") {
      messageTitle = t("BlogDetail.premium");
      messageContent = t("BlogDetail.premiumContent");
      actionText = t("BlogDetail.upgrade");
      actionLink = `/#pricing`;
    }

    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-20 flex flex-col items-center">
        <div className="w-full max-w-md bg-card rounded-xl shadow-lg overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
          <div className="p-8">
            <div className="flex items-center justify-center mb-6">
              <div className="p-4 bg-primary/10 rounded-full">
                <LockIcon className="w-10 h-10 text-primary" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-center mb-4">
              {messageTitle}
            </h2>
            <p className="text-center text-muted-foreground mb-8">
              {messageContent}
            </p>
            {actionText && (
              <div className="flex justify-center gap-4">
                <Button asChild variant="outline">
                  <I18nLink
                    href={`/blogs`}
                    title={t("BlogDetail.backToBlogs")}
                    prefetch={false}
                    className="inline-flex items-center justify-center gap-2"
                  >
                    <ArrowLeftIcon className="w-4 h-4" />
                    {t("BlogDetail.backToBlogs")}
                  </I18nLink>
                </Button>
                <Button
                  className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white"
                  asChild
                >
                  <I18nLink
                    href={actionLink}
                    title={actionText}
                    className="inline-flex items-center justify-center gap-2"
                    prefetch={false}
                  >
                    {actionText}
                    <ArrowRightIcon className="w-4 h-4" />
                  </I18nLink>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    notFound();
  }

  const tagsArray = post.tags
    ? post.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag)
    : [];

  const getVisibilityInfo = () => {
    switch (post.visibility) {
      case "subscribers":
        return {
          label: "Subscribers Only",
          bgColor: "bg-purple-600",
        };
      case "logged_in":
        return {
          label: "Members Only",
          bgColor: "bg-blue-600",
        };
      default:
        return {
          label: "Public",
          bgColor: "bg-green-600",
        };
    }
  };

  const visibilityInfo = getVisibilityInfo();

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-8">
        <Button asChild variant="ghost" size="sm" className="group">
          <I18nLink
            href="/blogs"
            title={t("BlogDetail.backToBlogs")}
            prefetch={false}
          >
            <ArrowLeftIcon className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
            {t("BlogDetail.backToBlogs")}
          </I18nLink>
        </Button>
      </div>

      <header className="mb-12">
        {post.visibility !== "public" && (
          <div
            className={`${visibilityInfo.bgColor} text-white text-xs px-3 py-1 rounded-full inline-flex mb-6`}
          >
            {visibilityInfo.label}
          </div>
        )}

        <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
          {post.title}
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-8">
          <div className="flex items-center">
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dayjs(post.published_at).format("MMMM D, YYYY")}
          </div>

          {post.is_pinned && (
            <div className="flex items-center bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 px-2 py-0.5 rounded-md text-xs">
              {t("BlogDetail.featured")}
            </div>
          )}
        </div>

        {post.description && (
          <div className="bg-muted rounded-lg p-6 text-lg mb-8">
            {post.description}
          </div>
        )}
      </header>

      {post.featured_image_url && (
        <div className="my-10 rounded-xl overflow-hidden shadow-md aspect-video relative">
          <Image
            src={post.featured_image_url}
            alt={post.title}
            fill
            sizes="(max-width: 768px) 100vw, 1200px"
            priority
            className="object-cover"
            unoptimized={post.featured_image_url.startsWith("http")}
          />
        </div>
      )}

      {tagsArray.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-10">
          {tagsArray.map((tag) => (
            <div
              key={tag}
              className="rounded-full bg-secondary/80 hover:bg-secondary px-3 py-1 text-sm font-medium transition-colors"
            >
              {tag}
            </div>
          ))}
        </div>
      )}

      <article className="prose dark:prose-invert lg:prose-lg prose-headings:font-bold prose-headings:tracking-tight prose-a:text-primary prose-img:rounded-xl prose-img:shadow-md max-w-none">
        <MDXRemote source={post?.content || ""} components={MDXComponents} />
      </article>

      <div className="mt-16 pt-8 border-t">
        <Button asChild variant="outline" size="sm">
          <I18nLink
            href="/blogs"
            title={t("BlogDetail.backToBlogs")}
            prefetch={false}
            className="inline-flex items-center"
          >
            <ArrowLeftIcon className="mr-2 h-4 w-4" />
            {t("BlogDetail.backToBlogs")}
          </I18nLink>
        </Button>
      </div>
    </div>
  );
}

export async function generateStaticParams() {
  const allParams: { locale: string; slug: string }[] = [];

  for (const locale of LOCALES) {
    const { posts: localPosts } = await getPosts(locale);
    localPosts
      .filter((post) => post.slug && post.status !== "draft")
      .forEach((post) => {
        const slugPart = post.slug.replace(/^\//, "").replace(/^blogs\//, "");
        if (slugPart) {
          allParams.push({ locale, slug: slugPart });
        }
      });
  }

  for (const locale of LOCALES) {
    const serverResult = await listPublishedPostsAction({
      locale: locale,
      pageSize: 1000,
      visibility: "public",
    });
    if (serverResult.success && serverResult.data?.posts) {
      serverResult.data.posts.forEach((post) => {
        const slugPart = post.slug?.replace(/^\//, "").replace(/^blogs\//, "");
        if (slugPart) {
          allParams.push({ locale, slug: slugPart });
        }
      });
    }
  }

  const uniqueParams = Array.from(
    new Map(allParams.map((p) => [`${p.locale}-${p.slug}`, p])).values()
  );
  // console.log("Generated Static Params:", uniqueParams.slice(0, 10), "...");
  return uniqueParams;
}
