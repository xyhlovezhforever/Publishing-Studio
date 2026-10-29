import test from 'node:test'
import assert from 'node:assert/strict'
import { publishJob } from '../server/publisher.mjs'

const fixture = {
  job: { id: 'job_1', platform: 'xiaohongshu' },
  post: {
    id: 'post_1',
    title: '测试内容',
    content: '用于验证发布器请求结构。',
    tags: ['测试'],
    media: [{ id: 'media_1', name: 'cover.jpg', url: '/uploads/cover.jpg', type: 'image/jpeg' }],
  },
  account: { id: 'account_xhs', name: '测试账号' },
}

test('simulation mode does not call an external publisher', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = () => { throw new Error('fetch should not be called') }
  try {
    const result = await publishJob({ ...fixture, settings: { mode: 'simulation' } })
    assert.match(result.externalId, /^sim_/)
    assert.match(result.message, /模拟发布完成/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('webhook mode sends authorization and absolute media URLs', async () => {
  const originalFetch = globalThis.fetch
  const originalWebhook = process.env.XHS_WEBHOOK_URL
  const originalToken = process.env.WEBHOOK_TOKEN
  const originalBaseUrl = process.env.PUBLISHING_STUDIO_URL
  let request
  process.env.XHS_WEBHOOK_URL = 'http://127.0.0.1:5101/publish'
  process.env.WEBHOOK_TOKEN = 'local-test-token'
  process.env.PUBLISHING_STUDIO_URL = 'http://127.0.0.1:4173'
  globalThis.fetch = async (url, init) => {
    request = { url, init }
    return new Response(JSON.stringify({ id: 'external_1', message: 'accepted' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  try {
    const result = await publishJob({ ...fixture, settings: { mode: 'webhook' } })
    const body = JSON.parse(request.init.body)
    assert.equal(request.url, 'http://127.0.0.1:5101/publish')
    assert.equal(request.init.headers.authorization, 'Bearer local-test-token')
    assert.equal(body.post.media[0].url, 'http://127.0.0.1:4173/uploads/cover.jpg')
    assert.equal(result.externalId, 'external_1')
  } finally {
    globalThis.fetch = originalFetch
    if (originalWebhook === undefined) delete process.env.XHS_WEBHOOK_URL
    else process.env.XHS_WEBHOOK_URL = originalWebhook
    if (originalToken === undefined) delete process.env.WEBHOOK_TOKEN
    else process.env.WEBHOOK_TOKEN = originalToken
    if (originalBaseUrl === undefined) delete process.env.PUBLISHING_STUDIO_URL
    else process.env.PUBLISHING_STUDIO_URL = originalBaseUrl
  }
})
