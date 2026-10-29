import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

const now = () => new Date().toISOString()

export const seedState = () => ({
  posts: [
    {
      id: 'post_welcome',
      title: '把重复发稿变成一条清晰的队列',
      content: '今天开始，我们把同一份内容按平台规则整理后再发布。小红书保留短段落和话题，头条保留完整上下文。\n\n先预览，再排期，最后由本地发布器执行。',
      tags: ['内容运营', '工作流', '效率工具'],
      media: [{ id: 'media_demo', name: 'workspace.jpg', url: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1200&q=82', type: 'image/jpeg' }],
      updatedAt: now(),
    },
  ],
  jobs: [
    { id: 'job_demo_1', postId: 'post_welcome', platform: 'xiaohongshu', accountId: 'account_xhs', status: 'scheduled', scheduledAt: new Date(Date.now() + 86_400_000).toISOString(), createdAt: now(), attempts: 0 },
    { id: 'job_demo_2', postId: 'post_welcome', platform: 'toutiao', accountId: 'account_tt', status: 'draft', scheduledAt: null, createdAt: now(), attempts: 0 },
  ],
  accounts: [
    { id: 'account_xhs', platform: 'xiaohongshu', name: '小红书测试号', handle: '待连接', status: 'disconnected', lastCheckedAt: null },
    { id: 'account_tt', platform: 'toutiao', name: '头条测试号', handle: '待连接', status: 'disconnected', lastCheckedAt: null },
  ],
  activity: [
    { id: 'activity_seed', kind: 'system', message: '工作区已创建，当前处于模拟发布模式', createdAt: now() },
  ],
  settings: {
    mode: process.env.PUBLISH_MODE || 'simulation',
    timezone: 'Asia/Shanghai',
    requireReview: true,
    concurrency: 1,
  },
})

export class JsonStore {
  constructor(filePath) {
    this.filePath = filePath
    this.writeQueue = Promise.resolve()
  }

  async init() {
    await mkdir(path.dirname(this.filePath), { recursive: true })
    try {
      await readFile(this.filePath, 'utf8')
    } catch {
      await this.write(seedState())
    }
  }

  async read() {
    return JSON.parse(await readFile(this.filePath, 'utf8'))
  }

  async write(data) {
    this.writeQueue = this.writeQueue.then(async () => {
      const tempPath = `${this.filePath}.tmp`
      await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
      await rename(tempPath, this.filePath)
    })
    await this.writeQueue
    return data
  }

  async update(mutator) {
    const state = await this.read()
    const next = await mutator(state) || state
    return this.write(next)
  }
}
