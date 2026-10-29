import type { AppState, MediaItem, Platform, Post, Settings } from './types'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || '请求没有完成，请稍后重试')
  return data
}

export const api = {
  getState: () => request<AppState>('/api/state'),
  savePost: (post: Partial<Post>) => request<Post>('/api/posts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(post),
  }),
  upload: async (files: File[]) => {
    const body = new FormData()
    files.forEach((file) => body.append('files', file))
    return request<MediaItem[]>('/api/uploads', { method: 'POST', body })
  },
  createJobs: (input: { postId: string; platforms: Platform[]; scheduledAt: string | null; publishNow: boolean }) => request('/api/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }),
  updateJob: (id: string, action: 'retry' | 'cancel' | 'approve') => request(`/api/jobs/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action }),
  }),
  updateAccount: (id: string, input: { name: string; handle: string }) => request(`/api/accounts/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }),
  updateSettings: (settings: Settings) => request<Settings>('/api/settings', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(settings),
  }),
}
