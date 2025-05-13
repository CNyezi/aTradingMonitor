import { getPublishedPostBySlugAction, PublicPostWithContent } from '@/actions/blogs/posts';
import { DEFAULT_LOCALE } from '@/i18n/routing';
import { BlogPost } from '@/types/blog';
import dayjs from 'dayjs';
import fs from 'fs';
import matter from 'gray-matter';
import path from 'path';

const POSTS_BATCH_SIZE = 10;

export async function getPosts(locale: string = DEFAULT_LOCALE): Promise<{ posts: BlogPost[] }> {
  const postsDirectory = path.join(process.cwd(), 'blogs', locale);

  // is directory exist
  if (!fs.existsSync(postsDirectory)) {
    return { posts: [] };
  }

  let filenames = await fs.promises.readdir(postsDirectory);
  filenames = filenames.reverse();

  let allPosts: BlogPost[] = [];

  // read file by batch
  for (let i = 0; i < filenames.length; i += POSTS_BATCH_SIZE) {
    const batchFilenames = filenames.slice(i, i + POSTS_BATCH_SIZE);

    const batchPosts: BlogPost[] = await Promise.all(
      batchFilenames.map(async (filename) => {
        const fullPath = path.join(postsDirectory, filename);
        const fileContents = await fs.promises.readFile(fullPath, 'utf8');

        const { data, content } = matter(fileContents);

        return {
          locale, // use locale parameter
          title: data.title,
          description: data.description,
          featured_image_url: data.featured_image_url || '',
          slug: data.slug,
          tags: data.tags,
          published_at: data.published_at,
          status: data.status || 'published',
          is_pinned: data.is_pinned || false,
          content,
          metadata: data,
        };
      })
    );

    allPosts.push(...batchPosts);
  }

  // filter out non-published articles
  allPosts = allPosts.filter(post => post.status === 'published');

  // sort posts by is_pinned and published_at
  allPosts = allPosts.sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) {
      return (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0);
    }
    return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
  });

  return {
    posts: allPosts,
  };
}

function mapServerPostToBlogPost(serverPost: PublicPostWithContent, locale: string): BlogPost {
  return {
    locale: locale,
    title: serverPost.title,
    description: serverPost.description ?? "",
    featured_image_url: serverPost.featured_image_url ?? "",
    slug: serverPost.slug,
    tags: serverPost.tags ?? "",
    published_at:
      (serverPost.published_at && dayjs(serverPost.published_at).toDate()) || new Date(serverPost.created_at),
    status: serverPost.status ?? "published",
    is_pinned: serverPost.is_pinned ?? false,
    content: serverPost.content ?? '',
  };
}

export async function getPostBySlug(
  slug: string,
  locale: string = DEFAULT_LOCALE
): Promise<{ post: BlogPost | null; error?: string; errorCode?: string }> {
  const postsDirectory = path.join(process.cwd(), 'blogs', locale);
  if (fs.existsSync(postsDirectory)) {
    const filenames = await fs.promises.readdir(postsDirectory);
    for (const filename of filenames) {
      const fullPath = path.join(postsDirectory, filename);
      try {
        const fileContents = await fs.promises.readFile(fullPath, 'utf8');
        const { data, content } = matter(fileContents);

        const localSlug = (data.slug || '').replace(/^\//, '').replace(/\/$/, '');
        const targetSlug = slug.replace(/^\//, '').replace(/\/$/, '');

        if (localSlug === targetSlug && data.status !== 'draft') {
          return {
            post: {
              locale,
              title: data.title,
              description: data.description || '',
              featured_image_url: data.featured_image_url || '',
              slug: data.slug,
              tags: data.tags || '',
              published_at: data.published_at ? new Date(data.published_at) : new Date(),
              status: data.status || 'published',
              visibility: data.visibility || 'public',
              is_pinned: data.is_pinned || false,
              content,
              metadata: data,
            },
            error: undefined,
            errorCode: undefined,
          };
        }
      } catch (error) {
        console.error(`Error processing local file ${filename}:`, error);
      }
    }
  }

  const serverResult = await getPublishedPostBySlugAction({ slug, locale });

  if (serverResult.success && serverResult.data?.post) {
    return {
      post: mapServerPostToBlogPost(serverResult.data.post, locale),
      error: undefined,
      errorCode: undefined,
    };
  } else {
    const errorMessage = serverResult.error || "Post not found.";
    const errorCode = serverResult.customCode;
    return { post: null, error: errorMessage, errorCode: errorCode };
  }
}