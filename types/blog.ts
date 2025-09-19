
export type BlogPost = {
  locale?: string
  title: string
  description?: string
  featuredImageUrl?: string
  slug: string
  tags?: string
  publishedAt: Date
  status?: 'draft' | 'published' | 'archived'
  visibility?: 'public' | 'logged_in' | 'subscribers'
  isPinned?: boolean
  content: string
  metadata?: {
    [key: string]: any
  },
}

export type Tag = {
  id: string
  name: string
  createdAt: Date
}