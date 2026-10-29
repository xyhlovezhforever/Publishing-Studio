export type Platform = 'xiaohongshu' | 'toutiao'
export type JobStatus = 'draft' | 'scheduled' | 'queued' | 'publishing' | 'published' | 'failed' | 'cancelled' | 'review'

export interface MediaItem {
  id: string
  name: string
  url: string
  type: string
}

export interface Post {
  id: string
  title: string
  content: string
  tags: string[]
  media: MediaItem[]
  updatedAt: string
}

export interface Job {
  id: string
  postId: string
  platform: Platform
  accountId: string
  status: JobStatus
  scheduledAt: string | null
  createdAt: string
  publishedAt?: string
  attempts: number
  error?: string | null
  externalId?: string | null
}

export interface Account {
  id: string
  platform: Platform
  name: string
  handle: string
  status: 'disconnected' | 'configured' | 'connected'
  lastCheckedAt: string | null
}

export interface Activity {
  id: string
  kind: string
  message: string
  createdAt: string
}

export interface Settings {
  mode: 'simulation' | 'webhook'
  timezone: string
  requireReview: boolean
  concurrency: number
}

export interface AppState {
  posts: Post[]
  jobs: Job[]
  accounts: Account[]
  activity: Activity[]
  settings: Settings
}
