import { listPublishedPostsAction } from "@/actions/blogs/posts";
import { Callout } from "@/components/mdx/Callout";
import MDXComponents from "@/components/mdx/MDXComponents";
import { Button } from "@/components/ui/button";
import { Link as I18nLink, Locale, LOCALES } from "@/i18n/routing";
import { getPostBySlug, getPosts } from "@/lib/getBlogs";
import { constructMetadata } from "@/lib/metadata";
import { ArrowRightIcon, LockIcon } from "lucide-react";
import { Metadata } from "next";
import { MDXRemote } from "next-mdx-remote-client/rsc";
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
  const { locale, slug } = await params;
  const {
    post,
    error: errorMessage,
    errorCode,
  } = await getPostBySlug(slug, locale);

  if (errorCode) {
    let messageTitle = "Access Restricted";
    let messageContent = errorMessage || "An error occurred.";
    let actionText = "";
    const redirectUrl = `/${locale}/blogs/${slug}`;
    let actionLink = `/login?next=${encodeURIComponent(redirectUrl)}`;

    if (errorCode === "unauthorized") {
      messageContent = "This content is only available to logged-in users.";
      actionText = "Sign In";
    } else if (errorCode === "notSubscriber") {
      messageTitle = "Premium Content";
      messageContent =
        "This content is exclusively available to our subscribers.";
      actionText = "Upgrade";
      actionLink = `/#pricing`;
    }

    return (
      <div className="w-full md:w-3/5 px-2 md:px-12 py-20 flex flex-col items-center">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="p-1 bg-gradient-to-r from-blue-500 to-teal-400"></div>
          <div className="p-8">
            <div className="flex items-center justify-center mb-6">
              <LockIcon className="w-12 h-12 text-blue-500" />
            </div>
            <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-white mb-3">
              {messageTitle}
            </h2>
            <p className="text-center text-gray-600 dark:text-gray-300 mb-6">
              {messageContent}
            </p>
            {actionText && (
              <div className="flex justify-center gap-4">
                <Button asChild variant="outline">
                  <I18nLink
                    href={`/blogs`}
                    prefetch={false}
                    className="inline-flex items-center justify-center"
                  >
                    Back to Blogs
                  </I18nLink>
                </Button>
                <Button
                  className="gradient-bg text-white hover:text-white rounded-lg hover:opacity-90 shadow-lg"
                  asChild
                >
                  <I18nLink
                    href={actionLink}
                    className="inline-flex items-center justify-center"
                  >
                    {actionText}
                    <ArrowRightIcon className="ml-2 -mr-1 w-4 h-4" />
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

  return (
    <div className="w-full md:w-3/5 px-2 md:px-12">
      <h1 className="break-words text-4xl font-bold mt-6 mb-4">{post.title}</h1>
      {post.featured_image_url && (
        <img
          src={post.featured_image_url}
          alt={post.title}
          className="rounded-sm mb-4"
        />
      )}
      {tagsArray.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {tagsArray.map((tag) => {
            return (
              <div
                key={tag}
                className={`rounded-md bg-gray-200 hover:!no-underline dark:bg-[#24272E] flex px-2.5 py-1.5 text-sm font-medium transition-colors hover:text-black hover:dark:bg-[#15AFD04C] hover:dark:text-[#82E9FF] text-gray-500 dark:text-[#7F818C] outline-none focus-visible:ring transition`}
              >
                {tag}
              </div>
            );
          })}
        </div>
      )}
      {post.description && <Callout>{post.description}</Callout>}
      <article className="prose dark:prose-invert max-w-none">
        <MDXRemote source={post?.content || ""} components={MDXComponents} />
      </article>
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

  console.log("Generated Static Params:", uniqueParams.slice(0, 10), "...");

  return uniqueParams;
}
