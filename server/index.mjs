import 'dotenv/config'
import express from 'express'
import multer from 'multer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { JsonStore } from './store.mjs'
import { publishJob } from './publisher.mjs'
import { initialJobStatus } from './jobs.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const port = Number(process.env.PORT || 4173)
const app = express()
const store = new JsonStore(path.join(root, 'data', 'store.json'))
const uploadsDir = path.join(root, 'uploads')

await mkdir(uploadsDir, { recursive: true })
await store.init()

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${randomUUID()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 80 * 1024 * 1024, files: 9 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')),
})

app.use(express.json({ limit: '2mb' }))
app.use('/uploads', express.static(uploadsDir, { fallthrough: false }))

const postSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(2).max(80),
  content: z.string().trim().min(10).max(20_000),
  tags: z.array(z.string().trim().min(1).max(20)).max(10).default([]),
  media: z.array(z.object({ id: z.string(), name: z.string(), url: z.string(), type: z.string() })).max(9).default([]),
})

const jobSchema = z.object({
  postId: z.string(),
  platforms: z.array(z.enum(['xiaohongshu', 'toutiao'])).min(1),
  scheduledAt: z.string().datetime().nullable(),
  publishNow: z.boolean().default(false),
})

const settingsSchema = z.object({
  mode: z.enum(['simulation', 'webhook']),
  timezone: z.string().min(1),
  requireReview: z.boolean(),
  concurrency: z.number().int().min(1).max(3),
})

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }))
app.get('/api/state', async (_req, res, next) => {
  try { res.json(await store.read()) } catch (error) { next(error) }
})

app.post('/api/uploads', upload.array('files', 9), (req, res) => {
  const files = (req.files || []).map((file) => ({
    id: randomUUID(),
    name: file.originalname,
    url: `/uploads/${file.filename}`,
    type: file.mimetype,
  }))
  res.status(201).json(files)
})

app.post('/api/posts', async (req, res, next) => {
  try {
    const input = postSchema.parse(req.body)
    const post = { ...input, id: input.id || randomUUID(), updatedAt: new Date().toISOString() }
    await store.update((state) => {
      const index = state.posts.findIndex((item) => item.id === post.id)
      if (index >= 0) state.posts[index] = post
      else state.posts.unshift(post)
      state.activity.unshift({ id: randomUUID(), kind: 'post', message: `已保存内容「${post.title}」`, createdAt: new Date().toISOString() })
      return state
    })
    res.status(201).json(post)
  } catch (error) { next(error) }
})

app.post('/api/jobs', async (req, res, next) => {
  try {
    const input = jobSchema.parse(req.body)
    const state = await store.read()
    const post = state.posts.find((item) => item.id === input.postId)
    if (!post) return res.status(404).json({ error: '找不到要发布的内容' })
    const jobs = input.platforms.map((platform) => ({
      id: randomUUID(),
      postId: input.postId,
      platform,
      accountId: platform === 'xiaohongshu' ? 'account_xhs' : 'account_tt',
      status: initialJobStatus(state.settings, input),
      scheduledAt: input.publishNow ? new Date().toISOString() : input.scheduledAt,
      createdAt: new Date().toISOString(),
      attempts: 0,
    }))
    await store.update((next) => {
      next.jobs.unshift(...jobs)
      next.activity.unshift({ id: randomUUID(), kind: 'queue', message: `「${post.title}」已加入 ${jobs.length} 个发布队列`, createdAt: new Date().toISOString() })
      return next
    })
    res.status(201).json(jobs)
    setTimeout(processDueJobs, 50)
  } catch (error) { next(error) }
})

app.patch('/api/jobs/:id', async (req, res, next) => {
  try {
    const action = z.enum(['retry', 'cancel', 'approve']).parse(req.body.action)
    let updated
    await store.update((state) => {
      const job = state.jobs.find((item) => item.id === req.params.id)
      if (!job) return state
      if (action === 'cancel') job.status = 'cancelled'
      if (action === 'retry') { job.status = 'queued'; job.error = null; job.scheduledAt = new Date().toISOString() }
      if (action === 'approve' && job.status === 'review') job.status = 'queued'
      updated = job
      return state
    })
    if (!updated) return res.status(404).json({ error: '找不到该任务' })
    res.json(updated)
    if (action !== 'cancel') setTimeout(processDueJobs, 50)
  } catch (error) { next(error) }
})

app.patch('/api/accounts/:id', async (req, res, next) => {
  try {
    const input = z.object({ name: z.string().min(2).max(40), handle: z.string().min(1).max(60) }).parse(req.body)
    let updated
    await store.update((state) => {
      const account = state.accounts.find((item) => item.id === req.params.id)
      if (!account) return state
      Object.assign(account, input, { status: 'configured', lastCheckedAt: new Date().toISOString() })
      updated = account
      return state
    })
    if (!updated) return res.status(404).json({ error: '找不到该账号' })
    res.json(updated)
  } catch (error) { next(error) }
})

app.put('/api/settings', async (req, res, next) => {
  try {
    const settings = settingsSchema.parse(req.body)
    await store.update((state) => { state.settings = settings; return state })
    res.json(settings)
  } catch (error) { next(error) }
})

let processing = false
async function processDueJobs() {
  if (processing) return
  processing = true
  try {
    const state = await store.read()
    const due = state.jobs.find((job) => ['queued', 'scheduled'].includes(job.status) && job.scheduledAt && new Date(job.scheduledAt) <= new Date())
    if (!due) return
    const post = state.posts.find((item) => item.id === due.postId)
    const account = state.accounts.find((item) => item.id === due.accountId)
    if (!post || !account) throw new Error('任务缺少内容或账号')

    await store.update((next) => {
      const job = next.jobs.find((item) => item.id === due.id)
      job.status = 'publishing'
      job.attempts += 1
      return next
    })

    try {
      const result = await publishJob({ job: due, post, account, settings: state.settings })
      await store.update((next) => {
        const job = next.jobs.find((item) => item.id === due.id)
        Object.assign(job, { status: 'published', publishedAt: new Date().toISOString(), externalId: result.externalId, error: null })
        next.activity.unshift({ id: randomUUID(), kind: 'publish', message: result.message, createdAt: new Date().toISOString() })
        return next
      })
    } catch (error) {
      await store.update((next) => {
        const job = next.jobs.find((item) => item.id === due.id)
        Object.assign(job, { status: 'failed', error: error.message })
        next.activity.unshift({ id: randomUUID(), kind: 'error', message: `${post.title} 发布失败：${error.message}`, createdAt: new Date().toISOString() })
        return next
      })
    }
  } finally {
    processing = false
    const state = await store.read()
    const more = state.jobs.some((job) => ['queued', 'scheduled'].includes(job.status) && job.scheduledAt && new Date(job.scheduledAt) <= new Date())
    if (more) setTimeout(processDueJobs, 100)
  }
}

setInterval(processDueJobs, 15_000).unref()

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(root, 'dist')))
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')))
} else {
  const { createServer } = await import('vite')
  const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'spa' })
  app.use(vite.middlewares)
}

app.use((error, _req, res, _next) => {
  console.error(error)
  if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues[0]?.message || '提交内容有误' })
  if (error instanceof multer.MulterError) return res.status(400).json({ error: error.message })
  res.status(500).json({ error: error.message || '服务器暂时无法处理请求' })
})

const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Publishing Studio running at http://127.0.0.1:${port}`)
})

export { app, server, store }
