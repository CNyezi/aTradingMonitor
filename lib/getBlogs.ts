import { DEFAULT_LOCALE } from '@/i18n/routing';
import { BlogPost } from '@/types/blog';
import fs from 'fs';
import matter from 'gray-matter';
import path from 'path';

const POSTS_BATCH_SIZE = 10;

export async function getPosts(locale: string = DEFAULT_LOCALE): Promise<{ posts: BlogPost[] }> {
  const postsDirectory = path.join(process.cwd(), 'blogs', locale);

  if (!fs.existsSync(postsDirectory)) {
    return { posts: [] };
  }

  let filenames = await fs.promises.readdir(postsDirectory);
  filenames = filenames.reverse();

  let allPosts: BlogPost[] = [];

  for (let i = 0; i < filenames.length; i += POSTS_BATCH_SIZE) {
    const batchFilenames = filenames.slice(i, i + POSTS_BATCH_SIZE);

    const batchPosts: BlogPost[] = await Promise.all(
      batchFilenames.map(async (filename) => {
        const fullPath = path.join(postsDirectory, filename);
        const fileContents = await fs.promises.readFile(fullPath, 'utf8');

        const { data, content } = matter(fileContents);

        return {
          locale,
          title: data.title,
          description: data.description,
          image: data.image || '',
          slug: data.slug,
          tags: data.tags,
          date: data.date,
          visible: data.visible || 'published',
          pin: data.pin || false,
          content,
          metadata: data,
        };
      })
    );

    allPosts.push(...batchPosts);
  }

  allPosts = allPosts.filter(post => post.visible === 'published');

  allPosts = allPosts.sort((a, b) => {
    if (a.pin !== b.pin) {
      return (b.pin ? 1 : 0) - (a.pin ? 1 : 0);
    }
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return {
    posts: allPosts,
  };
}