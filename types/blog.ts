
export type BlogPost = {
  locale?: string
  title: string
  description?: string
  featured_image_url?: string
  slug: string
  tags?: string
  published_at: Date
  status?: 'draft' | 'published' | 'archived'
  visibility?: 'public' | 'logged_in' | 'subscribers'
  is_pinned?: boolean
  content: string
  metadata?: {
    [key: string]: any
  },
}
