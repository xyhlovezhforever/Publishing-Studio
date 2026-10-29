const platformNames = { xiaohongshu: '小红书', toutiao: '今日头条' }

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function publishJob({ job, post, account, settings }) {
  const platformName = platformNames[job.platform] || job.platform
  if (settings.mode === 'simulation') {
    await wait(900)
    return {
      externalId: `sim_${Date.now()}`,
      message: `${platformName}模拟发布完成，没有向外部平台发送内容`,
    }
  }

  const envName = job.platform === 'xiaohongshu' ? 'XHS_WEBHOOK_URL' : 'TOUTIAO_WEBHOOK_URL'
  const webhookUrl = process.env[envName]
  if (!webhookUrl) {
    throw new Error(`${platformName}尚未配置发布 Webhook`)
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(process.env.WEBHOOK_TOKEN ? { authorization: `Bearer ${process.env.WEBHOOK_TOKEN}` } : {}),
    },
    body: JSON.stringify({
      job,
      post: {
        ...post,
        media: post.media.map((item) => ({
          ...item,
          url: item.url.startsWith('/')
            ? new URL(item.url, process.env.PUBLISHING_STUDIO_URL || `http://127.0.0.1:${process.env.PORT || 4173}`).toString()
            : item.url,
        })),
      },
      account,
    }),
    signal: AbortSignal.timeout(120_000),
  })
  const body = await response.text()
  if (!response.ok) throw new Error(`Webhook 返回 ${response.status}: ${body.slice(0, 160)}`)
  let parsed = {}
  try { parsed = JSON.parse(body) } catch { parsed = { message: body } }
  return {
    externalId: parsed.id || parsed.externalId || null,
    message: parsed.message || `${platformName}发布器已接受任务`,
  }
}
