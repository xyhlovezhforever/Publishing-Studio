import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  ArrowRight,
  ArrowClockwise,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  Check,
  CheckCircle,
  Clock,
  CloudArrowUp,
  FileText,
  Gear,
  Image as ImageIcon,
  Info,
  ListChecks,
  MagnifyingGlass,
  NotePencil,
  PaperPlaneTilt,
  PlugsConnected,
  Plus,
  Pulse,
  SidebarSimple,
  SquaresFour,
  Sparkle,
  Trash,
  UserCircle,
  WarningCircle,
  X,
  XCircle,
} from '@phosphor-icons/react'
import { api } from './api'
import type { Account, AppState, Job, JobStatus, MediaItem, Platform, Post, Settings } from './types'

type Route = 'overview' | 'compose' | 'queue' | 'calendar' | 'accounts' | 'connectors' | 'settings'
type Notice = { kind: 'success' | 'error'; message: string } | null

const platformLabel: Record<Platform, string> = { xiaohongshu: '小红书', toutiao: '今日头条' }
const statusLabel: Record<JobStatus, string> = {
  draft: '草稿', scheduled: '已排期', queued: '等待中', publishing: '发布中', published: '已发布', failed: '失败', cancelled: '已取消', review: '待审核',
}
const navItems: Array<{ id: Route; label: string; icon: typeof NotePencil }> = [
  { id: 'overview', label: '工作台', icon: SquaresFour },
  { id: 'compose', label: '内容编辑', icon: NotePencil },
  { id: 'queue', label: '发布队列', icon: ListChecks },
  { id: 'calendar', label: '排期日历', icon: CalendarBlank },
  { id: 'accounts', label: '平台账号', icon: UserCircle },
  { id: 'connectors', label: '连接器', icon: PlugsConnected },
  { id: 'settings', label: '发布设置', icon: Gear },
]

const cn = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ')
const formatTime = (value?: string | null) => value ? new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) : '未设置'
const formatFullTime = (value?: string | null) => value ? new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) : '未设置'
const defaultSchedule = () => {
  const date = new Date(Date.now() + 3_600_000)
  date.setMinutes(Math.ceil(date.getMinutes() / 10) * 10, 0, 0)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function App() {
  const [state, setState] = useState<AppState | null>(null)
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash))
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<Notice>(null)
  const [legal, setLegal] = useState<'privacy' | 'terms' | null>(null)

  const refresh = async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const next = await api.getState()
      setState(next)
      setError('')
    } catch (cause) {
      if (!quiet) setError(cause instanceof Error ? cause.message : '无法读取工作区')
    } finally {
      if (!quiet) setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    const timer = window.setInterval(() => refresh(true), 4_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const onHash = () => setRoute(parseRoute(location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 3_500)
    return () => window.clearTimeout(timer)
  }, [notice])

  const navigate = (next: Route) => {
    location.hash = next
    setRoute(next)
    setSidebarOpen(false)
  }

  if (loading) return <LoadingScreen />
  if (error || !state) return <ErrorScreen message={error || '工作区没有返回数据'} onRetry={() => refresh()} />

  const activeTitle = navItems.find((item) => item.id === route)?.label || '页面'
  const pendingCount = state.jobs.filter((job) => ['scheduled', 'queued', 'publishing', 'review'].includes(job.status)).length

  return (
    <div className="app-shell">
      <Sidebar active={route} open={sidebarOpen} onNavigate={navigate} onClose={() => setSidebarOpen(false)} pendingCount={pendingCount} />
      <div className="workspace">
        <header className="topbar">
          <button className="icon-button mobile-only" type="button" onClick={() => setSidebarOpen(true)} aria-label="打开导航"><SidebarSimple size={20} /></button>
          <div>
            <p className="eyebrow">工作区</p>
            <h1>{activeTitle}</h1>
          </div>
          <div className="topbar-actions">
            <div className={cn('mode-pill', state.settings.mode)}><span />{state.settings.mode === 'simulation' ? '模拟发布' : '外部发布器'}</div>
            <button className="icon-button" type="button" onClick={() => refresh()} aria-label="刷新数据"><ArrowClockwise size={19} /></button>
          </div>
        </header>

        <main id="main-content" className="main-content">
          {route === 'overview' && <OverviewView state={state} onNavigate={navigate} />}
          {route === 'compose' && <ComposeView state={state} refresh={refresh} notify={setNotice} onQueue={() => navigate('queue')} />}
          {route === 'queue' && <QueueView state={state} refresh={refresh} notify={setNotice} />}
          {route === 'calendar' && <CalendarView state={state} />}
          {route === 'accounts' && <AccountsView accounts={state.accounts} refresh={refresh} notify={setNotice} />}
          {route === 'connectors' && <ConnectorsView onNavigate={navigate} />}
          {route === 'settings' && <SettingsView settings={state.settings} refresh={refresh} notify={setNotice} />}
        </main>

        <footer className="footer">
          <span>所有内容与登录态保存在本机</span>
          <div><button type="button" onClick={() => setLegal('privacy')}>隐私说明</button><button type="button" onClick={() => setLegal('terms')}>使用边界</button></div>
        </footer>
      </div>
      {notice && <Toast notice={notice} onClose={() => setNotice(null)} />}
      {legal && <LegalDialog type={legal} onClose={() => setLegal(null)} />}
    </div>
  )
}

function parseRoute(hash: string): Route {
  const route = hash.replace('#', '') as Route
  return navItems.some((item) => item.id === route) ? route : 'overview'
}

function Sidebar({ active, open, onNavigate, onClose, pendingCount }: { active: Route; open: boolean; onNavigate: (route: Route) => void; onClose: () => void; pendingCount: number }) {
  return (
    <>
      <button type="button" className={cn('sidebar-scrim', open && 'visible')} onClick={onClose} aria-label="关闭导航" />
      <aside className={cn('sidebar', open && 'open')}>
        <div className="brand"><div className="brand-mark">发</div><div><strong>发稿台</strong><span>Publishing Studio</span></div></div>
        <nav aria-label="主要导航">
          {navItems.map((item) => {
            const Icon = item.icon
            return <button key={item.id} type="button" className={cn('nav-item', active === item.id && 'active')} onClick={() => onNavigate(item.id)} aria-current={active === item.id ? 'page' : undefined}><Icon size={20} weight={active === item.id ? 'fill' : 'regular'} /><span>{item.label}</span>{item.id === 'queue' && pendingCount > 0 && <b>{pendingCount}</b>}</button>
          })}
        </nav>
        <div className="sidebar-status">
          <div className="status-icon"><CheckCircle size={20} weight="fill" /></div>
          <div><strong>本地服务正常</strong><span>队列每 15 秒检查一次</span></div>
        </div>
        <div className="sidebar-user"><div className="avatar">本</div><div><strong>本地工作区</strong><span>管理员</span></div><Gear size={18} /></div>
      </aside>
    </>
  )
}

function OverviewView({ state, onNavigate }: { state: AppState; onNavigate: (route: Route) => void }) {
  const pending = state.jobs.filter((job) => ['scheduled', 'queued', 'publishing', 'review'].includes(job.status)).length
  const published = state.jobs.filter((job) => job.status === 'published').length
  const failed = state.jobs.filter((job) => job.status === 'failed').length
  const connected = state.accounts.filter((account) => account.status !== 'disconnected').length
  const nextJobs = state.jobs
    .filter((job) => job.scheduledAt && ['scheduled', 'queued', 'review'].includes(job.status))
    .sort((left, right) => new Date(left.scheduledAt || 0).getTime() - new Date(right.scheduledAt || 0).getTime())
    .slice(0, 4)

  return <div className="dashboard reveal-section">
    <section className="dashboard-hero">
      <div>
        <p className="eyebrow">统一发布工作区</p>
        <h2>把内容、账号和发布器<br />放进同一条清晰的流程</h2>
        <p>先在本地完成编辑与平台校验，再交给独立连接器执行。所有任务都有排期、状态和运行记录。</p>
        <div className="hero-actions"><button className="button primary" type="button" onClick={() => onNavigate('compose')}><NotePencil size={19} />创建内容</button><button className="button ghost" type="button" onClick={() => onNavigate('queue')}>查看队列<ArrowRight size={18} /></button></div>
      </div>
      <div className="hero-flow" aria-label="发布流程">
        <div><span>01</span><strong>统一内容</strong><small>标题、正文与素材</small></div>
        <ArrowRight size={20} />
        <div><span>02</span><strong>平台适配</strong><small>规则检查与预览</small></div>
        <ArrowRight size={20} />
        <div><span>03</span><strong>连接器执行</strong><small>状态与结果回传</small></div>
      </div>
    </section>

    <section className="overview-metrics" aria-label="工作区指标">
      <button type="button" onClick={() => onNavigate('queue')}><span>待执行任务</span><strong>{pending}</strong><small>查看排期与审核状态</small></button>
      <button type="button" onClick={() => onNavigate('queue')}><span>已发布</span><strong>{published}</strong><small>当前工作区累计完成</small></button>
      <button type="button" onClick={() => onNavigate('queue')}><span>需要处理</span><strong className={failed ? 'danger-text' : ''}>{failed}</strong><small>失败任务可重新执行</small></button>
      <button type="button" onClick={() => onNavigate('accounts')}><span>已配置账号</span><strong>{connected}<em> / {state.accounts.length}</em></strong><small>小红书与今日头条</small></button>
    </section>

    <div className="overview-grid">
      <section className="overview-panel">
        <div className="panel-heading"><div><p className="eyebrow">下一步</p><h2>即将执行</h2></div><button className="text-button" type="button" onClick={() => onNavigate('calendar')}>完整日历<ArrowRight size={16} /></button></div>
        {nextJobs.length === 0 ? <EmptyState icon={<CalendarBlank size={34} />} title="还没有排期" body="创建内容并选择发布时间，任务会显示在这里。" action="安排第一条内容" onAction={() => onNavigate('compose')} /> : <div className="next-list">{nextJobs.map((job) => { const post = state.posts.find((item) => item.id === job.postId); return <button type="button" key={job.id} onClick={() => onNavigate('queue')}><div className="date-tile"><strong>{new Date(job.scheduledAt || '').getDate()}</strong><span>{new Intl.DateTimeFormat('zh-CN', { month: 'short' }).format(new Date(job.scheduledAt || ''))}</span></div><div><strong>{post?.title || '内容已删除'}</strong><span>{formatFullTime(job.scheduledAt)}</span></div><PlatformBadge platform={job.platform} /></button> })}</div>}
      </section>
      <section className="overview-panel connector-summary">
        <div className="panel-heading"><div><p className="eyebrow">执行层</p><h2>开源连接器</h2></div><button className="text-button" type="button" onClick={() => onNavigate('connectors')}>查看全部<ArrowRight size={16} /></button></div>
        <p className="summary-copy">六个项目按能力归入统一适配层。平台只发送标准任务，不在前端保存 Cookie 或账号密码。</p>
        <div className="connector-mini-list"><div><i className="mini-logo coral">小</i><span><strong>小红书发布</strong><small>3 个可选连接器</small></span><b>Webhook</b></div><div><i className="mini-logo blue">头</i><span><strong>头条发布</strong><small>4 个可选连接器</small></span><b>Webhook</b></div><div><i className="mini-logo ink">多</i><span><strong>跨平台分发</strong><small>3 个候选方案</small></span><b>适配中</b></div></div>
      </section>
    </div>
    <ActivityFeed items={state.activity.slice(0, 5)} />
  </div>
}

function ComposeView({ state, refresh, notify, onQueue }: { state: AppState; refresh: (quiet?: boolean) => Promise<void>; notify: (notice: Notice) => void; onQueue: () => void }) {
  const initial = state.posts[0]
  const [postId, setPostId] = useState<string | undefined>(initial?.id)
  const [title, setTitle] = useState(initial?.title || '')
  const [content, setContent] = useState(initial?.content || '')
  const [tags, setTags] = useState(initial?.tags.join(' ') || '')
  const [media, setMedia] = useState<MediaItem[]>(initial?.media || [])
  const [platforms, setPlatforms] = useState<Platform[]>(['xiaohongshu', 'toutiao'])
  const [previewPlatform, setPreviewPlatform] = useState<Platform>('xiaohongshu')
  const [publishNow, setPublishNow] = useState(false)
  const [scheduledAt, setScheduledAt] = useState(defaultSchedule)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [formError, setFormError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const parsedTags = useMemo(() => tags.split(/[\s,#]+/).map((tag) => tag.trim()).filter(Boolean).slice(0, 10), [tags])
  const warnings = useMemo(() => {
    const values: string[] = []
    if (platforms.includes('xiaohongshu') && title.length > 20) values.push('小红书标题建议控制在 20 字以内')
    if (platforms.includes('toutiao') && content.length < 200) values.push('头条文章低于 200 字，可能影响发布完整度')
    if (media.length === 0 && platforms.includes('xiaohongshu')) values.push('小红书图文至少添加一张图片')
    return values
  }, [content.length, media.length, platforms, title.length])

  const togglePlatform = (platform: Platform) => {
    setPlatforms((current) => current.includes(platform) ? current.filter((item) => item !== platform) : [...current, platform])
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    setFormError('')
    try {
      const uploaded = await api.upload(Array.from(files).slice(0, 9 - media.length))
      setMedia((current) => [...current, ...uploaded].slice(0, 9))
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : '素材上传失败')
    } finally { setUploading(false) }
  }

  const save = async (queue = false) => {
    setFormError('')
    if (title.trim().length < 2) return setFormError('标题至少需要 2 个字')
    if (content.trim().length < 10) return setFormError('正文至少需要 10 个字')
    if (platforms.length === 0 && queue) return setFormError('至少选择一个发布平台')
    if (!publishNow && queue && !scheduledAt) return setFormError('请选择发布时间')
    setSaving(true)
    try {
      const post = await api.savePost({ id: postId, title, content, tags: parsedTags, media })
      setPostId(post.id)
      if (queue) {
        await api.createJobs({ postId: post.id, platforms, scheduledAt: publishNow ? null : new Date(scheduledAt).toISOString(), publishNow })
        notify({ kind: 'success', message: publishNow ? '任务已进入发布队列' : '内容已按所选时间排期' })
        await refresh(true)
        onQueue()
      } else {
        notify({ kind: 'success', message: '草稿已保存到本地' })
        await refresh(true)
      }
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : '保存失败')
    } finally { setSaving(false) }
  }

  return (
    <div className="compose-layout reveal-section">
      <section className="editor-panel" aria-labelledby="editor-heading">
        <div className="panel-heading"><div><p className="eyebrow">新内容</p><h2 id="editor-heading">一次编辑，分别预览</h2></div><button className="button ghost small" type="button" onClick={() => save(false)} disabled={saving}>{saving ? '保存中' : '保存草稿'}</button></div>

        <div className="field-group">
          <label htmlFor="title">标题</label>
          <div className="input-wrap"><input id="title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} placeholder="输入一个清楚、具体的标题" /><span>{title.length}/80</span></div>
        </div>
        <div className="field-group">
          <div className="label-row"><label htmlFor="content">正文</label><div className="format-actions" aria-label="编辑工具"><button type="button" title="插入段落标题"><strong>H</strong></button><button type="button" title="加粗文本"><strong>B</strong></button><button type="button" title="插入列表"><ListChecks size={17} /></button></div></div>
          <textarea id="content" value={content} onChange={(event) => setContent(event.target.value)} placeholder="写下正文。建议一段只表达一个意思。" rows={13} />
          <div className="textarea-meta"><span>支持纯文本，发布器会按平台重新排版</span><span>{content.length} 字</span></div>
        </div>
        <div className="field-group">
          <label htmlFor="tags">话题标签</label>
          <input id="tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="内容运营 工作流 效率工具" />
          {parsedTags.length > 0 && <div className="tag-list">{parsedTags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
        </div>

        <div className="field-group">
          <div className="label-row"><label>图片与视频</label><span className="field-hint">最多 9 个素材，单个不超过 80 MB</span></div>
          <input ref={fileInput} className="visually-hidden" type="file" accept="image/*,video/*" multiple onChange={(event) => handleUpload(event.target.files)} />
          <button className={cn('upload-zone', uploading && 'loading')} type="button" onClick={() => fileInput.current?.click()} disabled={uploading || media.length >= 9}>
            <CloudArrowUp size={26} />
            <span>{uploading ? '正在上传素材' : '选择图片或视频'}</span>
            <small>点击选择，也可以一次添加多个文件</small>
          </button>
          {media.length > 0 && <div className="media-grid">{media.map((item, index) => <div className="media-item" key={item.id}>{item.type.startsWith('video/') ? <div className="video-placeholder"><PaperPlaneTilt size={28} /></div> : <img src={item.url} alt={`发布素材 ${index + 1}`} />}<span>{index + 1}</span><button type="button" onClick={() => setMedia((current) => current.filter((mediaItem) => mediaItem.id !== item.id))} aria-label={`移除 ${item.name}`}><X size={14} /></button></div>)}</div>}
        </div>

        <div className="publish-config">
          <div className="field-group compact"><label>发布平台</label><div className="platform-options"><PlatformToggle platform="xiaohongshu" active={platforms.includes('xiaohongshu')} onClick={() => togglePlatform('xiaohongshu')} /><PlatformToggle platform="toutiao" active={platforms.includes('toutiao')} onClick={() => togglePlatform('toutiao')} /></div></div>
          <div className="field-group compact"><label>发布时间</label><div className="segmented"><button type="button" className={publishNow ? 'active' : ''} onClick={() => setPublishNow(true)}>立即发布</button><button type="button" className={!publishNow ? 'active' : ''} onClick={() => setPublishNow(false)}>定时发布</button></div>{!publishNow && <input type="datetime-local" value={scheduledAt} min={new Date().toISOString().slice(0, 16)} onChange={(event) => setScheduledAt(event.target.value)} />}</div>
        </div>

        {warnings.length > 0 && <div className="validation-box"><WarningCircle size={20} /><div><strong>发布前建议调整</strong>{warnings.map((warning) => <span key={warning}>{warning}</span>)}</div></div>}
        {formError && <div className="inline-error"><XCircle size={18} />{formError}</div>}
        <button className="button primary publish-button" type="button" onClick={() => save(true)} disabled={saving}><PaperPlaneTilt size={19} weight="fill" />{saving ? '正在创建任务' : publishNow ? '加入发布队列' : '保存并排期'}<span>{platforms.length} 个平台</span></button>
      </section>

      <aside className="preview-panel" aria-label="平台预览">
        <div className="preview-toolbar"><div><p className="eyebrow">实时预览</p><h2>平台显示效果</h2></div><div className="preview-tabs" role="tablist">{(['xiaohongshu', 'toutiao'] as Platform[]).map((platform) => <button key={platform} type="button" role="tab" aria-selected={previewPlatform === platform} className={previewPlatform === platform ? 'active' : ''} onClick={() => setPreviewPlatform(platform)}>{platformLabel[platform]}</button>)}</div></div>
        {previewPlatform === 'xiaohongshu' ? <XhsPreview title={title} content={content} tags={parsedTags} media={media} /> : <ToutiaoPreview title={title} content={content} media={media} />}
        <div className="preview-note"><Info size={18} /><span>预览用于检查结构，字体与裁切以平台最终页面为准。</span></div>
        <TaglineReveal />
      </aside>
    </div>
  )
}

function PlatformToggle({ platform, active, onClick }: { platform: Platform; active: boolean; onClick: () => void }) {
  return <button type="button" className={cn('platform-toggle', platform, active && 'active')} onClick={onClick} aria-pressed={active}><span className="platform-logo">{platform === 'xiaohongshu' ? '小' : '头'}</span><span><strong>{platformLabel[platform]}</strong><small>{platform === 'xiaohongshu' ? '图文笔记' : '长文章'}</small></span><i>{active && <Check size={14} weight="bold" />}</i></button>
}

function XhsPreview({ title, content, tags, media }: { title: string; content: string; tags: string[]; media: MediaItem[] }) {
  const image = media.find((item) => item.type.startsWith('image/'))
  return <div className="phone-frame"><div className="phone-top"><span>9:41</span><div /><span>•••</span></div><div className="xhs-header"><CaretLeft size={20} /><div className="preview-author"><div className="avatar coral">稿</div><span>内容工作室</span></div><button type="button">关注</button></div><div className="preview-media">{image ? <img src={image.url} alt="小红书笔记封面预览" /> : <div className="empty-media"><ImageIcon size={38} /><span>添加封面图片</span></div>}<span>1/{Math.max(1, media.length)}</span></div><article className="xhs-copy"><h3>{title || '在这里预览笔记标题'}</h3><p>{content || '正文会显示在这里。使用短段落，让读者更容易在手机上阅读。'}</p><div className="preview-tags">{tags.map((tag) => <span key={tag}>#{tag}</span>)}</div><small>刚刚 · 上海</small></article><div className="phone-actions"><div>说点什么…</div><span>♡ 18</span><span>☆ 7</span><span>◌ 3</span></div></div>
}

function ToutiaoPreview({ title, content, media }: { title: string; content: string; media: MediaItem[] }) {
  const image = media.find((item) => item.type.startsWith('image/'))
  return <div className="article-preview"><div className="article-browser"><div><i /><i /><i /></div><span>今日头条 · 文章预览</span><span>···</span></div><article><div className="article-channel">内容工作室 <span>原创</span></div><h3>{title || '在这里预览文章标题'}</h3><div className="article-meta">2026年10月29日 · 阅读约 {Math.max(1, Math.ceil(content.length / 400))} 分钟</div>{image && <img src={image.url} alt="头条文章题图预览" />}<div className="article-body">{(content || '正文会显示在这里。头条文章适合保留完整背景、过程和结论。').split('\n').filter(Boolean).map((paragraph, index) => <p key={`${paragraph.slice(0, 12)}${index}`}>{paragraph}</p>)}</div></article></div>
}

function TaglineReveal() {
  const ref = useRef<HTMLParagraphElement>(null)
  const words = '一份内容先经过检查 再按每个平台的规则 稳稳进入发布队列'.split(' ')
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      element.querySelectorAll('span').forEach((word, index) => window.setTimeout(() => word.classList.add('visible'), index * 80))
      observer.disconnect()
    }, { threshold: 0.45 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return <div className="tagline-reveal"><p ref={ref}>{words.map((word, index) => <span key={`${word}${index}`}>{word} </span>)}</p></div>
}

function QueueView({ state, refresh, notify }: { state: AppState; refresh: (quiet?: boolean) => Promise<void>; notify: (notice: Notice) => void }) {
  const [filter, setFilter] = useState<'all' | JobStatus>('all')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState('')
  const jobs = state.jobs.filter((job) => filter === 'all' || job.status === filter).filter((job) => {
    const post = state.posts.find((item) => item.id === job.postId)
    return !search || post?.title.toLowerCase().includes(search.toLowerCase())
  })
  const stats = [
    ['待执行', state.jobs.filter((job) => ['scheduled', 'queued', 'review'].includes(job.status)).length, Clock],
    ['发布中', state.jobs.filter((job) => job.status === 'publishing').length, Pulse],
    ['已完成', state.jobs.filter((job) => job.status === 'published').length, CheckCircle],
    ['需处理', state.jobs.filter((job) => job.status === 'failed').length, WarningCircle],
  ] as const
  const action = async (job: Job, next: 'retry' | 'cancel' | 'approve') => {
    setBusy(job.id)
    try {
      await api.updateJob(job.id, next)
      await refresh(true)
      notify({ kind: 'success', message: next === 'retry' ? '任务已重新进入队列' : '任务状态已更新' })
    } catch (cause) { notify({ kind: 'error', message: cause instanceof Error ? cause.message : '操作失败' }) }
    finally { setBusy('') }
  }
  return <div className="page-stack reveal-section"><section className="metrics-band">{stats.map(([label, value, Icon]) => <div className="metric" key={label}><div><span>{label}</span><strong>{value}</strong></div><Icon size={22} /></div>)}</section><section className="table-section"><div className="section-toolbar"><div><h2>全部发布任务</h2><p>查看每个平台的独立执行状态</p></div><div className="toolbar-controls"><label className="search-field"><MagnifyingGlass size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索标题" aria-label="搜索标题" /></label><select value={filter} onChange={(event) => setFilter(event.target.value as 'all' | JobStatus)} aria-label="筛选任务状态"><option value="all">全部状态</option><option value="review">待审核</option><option value="scheduled">已排期</option><option value="queued">等待中</option><option value="publishing">发布中</option><option value="published">已发布</option><option value="failed">失败</option><option value="cancelled">已取消</option></select></div></div>{jobs.length === 0 ? <EmptyState icon={<ListChecks size={34} />} title="没有符合条件的任务" body="修改筛选条件，或者先在内容编辑页创建一条发布任务。" action="创建内容" onAction={() => { location.hash = 'compose' }} /> : <div className="table-wrap"><table><thead><tr><th>内容</th><th>平台</th><th>计划时间</th><th>状态</th><th>尝试</th><th><span className="visually-hidden">操作</span></th></tr></thead><tbody>{jobs.map((job) => { const post = state.posts.find((item) => item.id === job.postId); return <tr key={job.id}><td><div className="content-cell"><div className={cn('tiny-cover', !post?.media[0] && 'blank')}>{post?.media[0]?.type.startsWith('image/') ? <img src={post.media[0].url} alt="" /> : <FileText size={20} />}</div><div><strong>{post?.title || '内容已删除'}</strong><span>{post?.content.slice(0, 38)}{(post?.content.length || 0) > 38 ? '…' : ''}</span></div></div></td><td><PlatformBadge platform={job.platform} /></td><td>{job.status === 'published' ? formatTime(job.publishedAt) : formatTime(job.scheduledAt)}</td><td><StatusBadge status={job.status} /></td><td>{job.attempts} 次</td><td><div className="row-actions">{job.status === 'review' && <button type="button" onClick={() => action(job, 'approve')} disabled={busy === job.id} title="审核通过"><Check size={18} /></button>}{job.status === 'failed' && <button type="button" onClick={() => action(job, 'retry')} disabled={busy === job.id} title="重试"><ArrowClockwise size={18} /></button>}{['review', 'scheduled', 'queued'].includes(job.status) && <button type="button" onClick={() => action(job, 'cancel')} disabled={busy === job.id} title="取消任务"><X size={18} /></button>}</div>{job.error && <small className="row-error">{job.error}</small>}</td></tr> })}</tbody></table></div>}</section><ActivityFeed items={state.activity.slice(0, 6)} /></div>
}

function CalendarView({ state }: { state: AppState }) {
  const [offset, setOffset] = useState(0)
  const start = useMemo(() => { const date = new Date(); date.setDate(date.getDate() - ((date.getDay() + 6) % 7) + offset * 7); date.setHours(0, 0, 0, 0); return date }, [offset])
  const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return date })
  return <div className="page-stack reveal-section"><section className="calendar-section"><div className="section-toolbar"><div><p className="eyebrow">七天排期</p><h2>{formatWeekRange(days[0], days[6])}</h2></div><div className="calendar-nav"><button type="button" className="icon-button" onClick={() => setOffset((value) => value - 1)} aria-label="上一周"><CaretLeft size={18} /></button><button type="button" className="button ghost small" onClick={() => setOffset(0)}>本周</button><button type="button" className="icon-button" onClick={() => setOffset((value) => value + 1)} aria-label="下一周"><CaretRight size={18} /></button></div></div><div className="calendar-grid">{days.map((day) => { const jobs = state.jobs.filter((job) => job.scheduledAt && sameDay(new Date(job.scheduledAt), day)); const today = sameDay(day, new Date()); return <div className={cn('calendar-day', today && 'today')} key={day.toISOString()}><div className="day-head"><span>{new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(day)}</span><strong>{day.getDate()}</strong></div><div className="day-jobs">{jobs.map((job) => { const post = state.posts.find((item) => item.id === job.postId); return <div className={cn('calendar-job', job.platform)} key={job.id}><span>{formatClock(job.scheduledAt)}</span><strong>{post?.title || '内容已删除'}</strong><PlatformBadge platform={job.platform} compact /></div> })}{jobs.length === 0 && <span className="empty-day">暂无任务</span>}</div></div> })}</div></section><section className="upcoming-section"><div className="panel-heading"><div><p className="eyebrow">接下来</p><h2>即将执行的任务</h2></div></div>{state.jobs.filter((job) => ['scheduled', 'queued'].includes(job.status)).slice(0, 4).map((job) => { const post = state.posts.find((item) => item.id === job.postId); return <div className="upcoming-row" key={job.id}><div className="date-tile"><strong>{new Date(job.scheduledAt || '').getDate()}</strong><span>{new Intl.DateTimeFormat('zh-CN', { month: 'short' }).format(new Date(job.scheduledAt || ''))}</span></div><div><strong>{post?.title}</strong><span>{formatFullTime(job.scheduledAt)}</span></div><PlatformBadge platform={job.platform} /></div> })}</section></div>
}

function AccountsView({ accounts, refresh, notify }: { accounts: Account[]; refresh: (quiet?: boolean) => Promise<void>; notify: (notice: Notice) => void }) {
  const [editing, setEditing] = useState<Account | null>(null)
  return <div className="page-stack narrow reveal-section"><section className="intro-band"><div><p className="eyebrow">平台连接</p><h2>账号与发布器分开管理</h2><p>这里只保存账号显示名称，不收集平台密码。真实登录应在外部发布器的浏览器中完成。</p></div><div className="security-note"><CheckCircle size={22} weight="fill" /><span>Cookie 不进入网页前端</span></div></section><div className="account-list">{accounts.map((account) => <article className="account-card" key={account.id}><div className={cn('account-platform', account.platform)}>{account.platform === 'xiaohongshu' ? '小' : '头'}</div><div className="account-main"><div><h3>{account.name}</h3><span>{account.handle}</span></div><StatusDot status={account.status} /></div><dl><div><dt>发布内容</dt><dd>{account.platform === 'xiaohongshu' ? '图文与视频' : '文章与微头条'}</dd></div><div><dt>连接方式</dt><dd>本地 Webhook</dd></div><div><dt>最近检查</dt><dd>{account.lastCheckedAt ? formatFullTime(account.lastCheckedAt) : '尚未检查'}</dd></div></dl><button className="button ghost" type="button" onClick={() => setEditing(account)}><Gear size={18} />配置账号</button></article>)}</div><section className="guide-strip"><Info size={22} /><div><strong>接入现有开源发布器</strong><p>在发布设置中切换到外部发布器，再将小红书或头条的本地桥接地址写入环境变量。具体字段见项目 README。</p></div></section>{editing && <AccountDialog account={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await refresh(true); notify({ kind: 'success', message: '账号显示信息已保存' }) }} />}</div>
}

function AccountDialog({ account, onClose, onSaved }: { account: Account; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(account.name)
  const [handle, setHandle] = useState(account.handle)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); try { await api.updateAccount(account.id, { name, handle }); onSaved() } catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败') } finally { setSaving(false) } }
  return <Dialog title={`配置${platformLabel[account.platform]}账号`} onClose={onClose}><form onSubmit={submit} className="dialog-form"><div className="field-group"><label htmlFor="account-name">显示名称</label><input id="account-name" required minLength={2} value={name} onChange={(event) => setName(event.target.value)} /></div><div className="field-group"><label htmlFor="account-handle">账号备注</label><input id="account-handle" required value={handle} onChange={(event) => setHandle(event.target.value)} placeholder="例如：品牌主账号" /></div><div className="dialog-info"><Info size={18} />平台登录仍需在外部发布器中完成。</div>{error && <div className="inline-error"><XCircle size={18} />{error}</div>}<div className="dialog-actions"><button className="button ghost" type="button" onClick={onClose}>取消</button><button className="button primary" type="submit" disabled={saving}>{saving ? '保存中' : '保存账号'}</button></div></form></Dialog>
}

const connectorCatalog = [
  { name: 'XiaohongshuSkills', scope: '小红书图文、视频', strengths: '多账号、定时与发布前预览', license: 'MIT', maturity: '近期活跃', role: '小红书专用连接器', platforms: ['小红书'] },
  { name: 'social-auto-upload', scope: '多平台图文、视频', strengths: 'CLI、定时发布，适合 Agent 调用', license: 'MIT', maturity: '成熟', role: '默认自动化候选', platforms: ['小红书', '头条'] },
  { name: 'Wechatsync', scope: '文章同步至 29 个以上平台', strengths: '浏览器扩展与草稿同步', license: 'GPL 3.0', maturity: '近期活跃', role: '文章同步候选', platforms: ['小红书', '头条', '多平台'] },
  { name: 'toutiao-publish', scope: '今日头条文章、微头条', strengths: '标题、正文、配图与封面发布', license: 'MIT', maturity: '专项工具', role: '头条专用连接器', platforms: ['头条'] },
  { name: 'MatrixMedia', scope: '图文与视频平台', strengths: '图形界面、CLI、批量多账号', license: 'GPL 2.0', maturity: '近期活跃', role: '批量发布候选', platforms: ['小红书', '头条'] },
  { name: 'MultiPublish', scope: '小红书、头条等视频平台', strengths: 'Windows 客户端与视频发布', license: 'MIT', maturity: '新项目', role: '桌面端候选', platforms: ['小红书', '头条'] },
]

function ConnectorsView({ onNavigate }: { onNavigate: (route: Route) => void }) {
  return <div className="page-stack narrow reveal-section">
    <section className="intro-band connector-intro"><div><p className="eyebrow">连接器目录</p><h2>统一任务协议，按场景选择执行器</h2><p>这些项目不直接混合进前端代码。它们通过标准 Webhook 接收任务，让许可证边界、登录态和平台变化都留在独立进程中。</p></div><div className="security-note"><PlugsConnected size={22} weight="fill" /><span>6 个候选项目</span></div></section>
    <section className="adapter-flow" aria-label="连接器架构"><div><span>发稿台</span><strong>统一内容与队列</strong></div><ArrowRight size={20} /><div><span>适配层</span><strong>标准 Webhook 任务</strong></div><ArrowRight size={20} /><div><span>执行器</span><strong>浏览器或桌面发布</strong></div></section>
    <div className="connector-grid">{connectorCatalog.map((connector, index) => <article className="connector-card" key={connector.name}>
      <div className="connector-card-head"><div className={cn('connector-index', index < 2 ? 'active' : '')}>{String(index + 1).padStart(2, '0')}</div><div><h3>{connector.name}</h3><span>{connector.role}</span></div><b>{connector.maturity}</b></div>
      <p>{connector.scope}</p>
      <div className="connector-platforms">{connector.platforms.map((platform) => <span key={platform}>{platform}</span>)}</div>
      <dl><div><dt>适合能力</dt><dd>{connector.strengths}</dd></div><div><dt>许可证</dt><dd>{connector.license}</dd></div><div><dt>接入状态</dt><dd>{index < 2 ? 'Webhook 字段已定义' : '等待适配器实现'}</dd></div></dl>
      <button className="button ghost" type="button" onClick={() => onNavigate('settings')}><Gear size={18} />查看接入设置</button>
    </article>)}</div>
    <section className="license-note"><Info size={22} /><div><strong>集成边界</strong><p>MIT 项目可以作为默认候选；GPL 项目建议保持独立服务，通过进程或网络接口调用。正式接入前仍需核对各仓库的最新许可证、平台协议与登录方式。</p></div></section>
  </div>
}

function SettingsView({ settings, refresh, notify }: { settings: Settings; refresh: (quiet?: boolean) => Promise<void>; notify: (notice: Notice) => void }) {
  const [form, setForm] = useState(settings)
  const [saving, setSaving] = useState(false)
  const save = async () => { setSaving(true); try { await api.updateSettings(form); await refresh(true); notify({ kind: 'success', message: '发布设置已保存' }) } catch (cause) { notify({ kind: 'error', message: cause instanceof Error ? cause.message : '保存失败' }) } finally { setSaving(false) } }
  return <div className="settings-layout reveal-section"><section className="settings-section"><div className="panel-heading"><div><p className="eyebrow">执行方式</p><h2>发布器设置</h2></div></div><div className="setting-row"><div><strong>发布模式</strong><span>模拟模式不会向平台发送任何内容</span></div><div className="segmented"><button type="button" className={form.mode === 'simulation' ? 'active' : ''} onClick={() => setForm({ ...form, mode: 'simulation' })}>模拟发布</button><button type="button" className={form.mode === 'webhook' ? 'active' : ''} onClick={() => setForm({ ...form, mode: 'webhook' })}>外部发布器</button></div></div>{form.mode === 'webhook' && <div className="config-callout"><WarningCircle size={21} /><div><strong>先配置环境变量</strong><p>设置 <code>XHS_WEBHOOK_URL</code>、<code>TOUTIAO_WEBHOOK_URL</code> 与可选的 <code>WEBHOOK_TOKEN</code>，然后重启服务。</p></div></div>}<div className="setting-row"><div><strong>发布前人工确认</strong><span>为后续外部发布器保留审核节点</span></div><button type="button" className={cn('switch', form.requireReview && 'on')} onClick={() => setForm({ ...form, requireReview: !form.requireReview })} role="switch" aria-checked={form.requireReview}><span /></button></div><div className="setting-row"><div><strong>同时执行任务</strong><span>低并发更不容易触发平台风控</span></div><select value={form.concurrency} onChange={(event) => setForm({ ...form, concurrency: Number(event.target.value) })}><option value={1}>1 个任务</option><option value={2}>2 个任务</option><option value={3}>3 个任务</option></select></div><div className="setting-row"><div><strong>工作区时区</strong><span>所有排期按此时区解释</span></div><select value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })}><option value="Asia/Shanghai">亚洲 上海</option><option value="Asia/Hong_Kong">亚洲 香港</option><option value="UTC">协调世界时</option></select></div><div className="settings-actions"><button className="button primary" type="button" onClick={save} disabled={saving}>{saving ? '保存中' : '保存设置'}</button></div></section><aside className="integration-guide"><div className="guide-icon"><Sparkle size={23} weight="fill" /></div><p className="eyebrow">推荐接法</p><h2>让网站只负责调度，让开源项目负责发布</h2><ol><li><span>1</span><div><strong>在本机运行发布器</strong><p>小红书可接 XiaohongshuSkills，头条可接 toutiao publish 或自建桥接服务。</p></div></li><li><span>2</span><div><strong>暴露本地 Webhook</strong><p>接收本站发送的标题、正文、标签、素材和排期信息。</p></div></li><li><span>3</span><div><strong>先用测试号验证</strong><p>平台页面变化会导致选择器失效，验证后再切换正式账号。</p></div></li></ol></aside></div>
}

function ActivityFeed({ items }: { items: AppState['activity'] }) {
  return <section className="activity-section"><div className="panel-heading"><div><p className="eyebrow">运行记录</p><h2>最近活动</h2></div></div><div className="activity-list">{items.map((item) => <div key={item.id}><span className={cn('activity-dot', item.kind)} /><p>{item.message}</p><time>{formatTime(item.createdAt)}</time></div>)}</div></section>
}

function PlatformBadge({ platform, compact = false }: { platform: Platform; compact?: boolean }) { return <span className={cn('platform-badge', platform, compact && 'compact')}><i>{platform === 'xiaohongshu' ? '小' : '头'}</i>{!compact && platformLabel[platform]}</span> }
function StatusBadge({ status }: { status: JobStatus }) { return <span className={cn('status-badge', status)}><i />{statusLabel[status]}</span> }
function StatusDot({ status }: { status: Account['status'] }) { return <span className={cn('connection-status', status)}><i />{status === 'disconnected' ? '待连接' : status === 'configured' ? '已配置' : '已连接'}</span> }

function EmptyState({ icon, title, body, action, onAction }: { icon: ReactNode; title: string; body: string; action: string; onAction: () => void }) { return <div className="empty-state"><div>{icon}</div><h3>{title}</h3><p>{body}</p><button className="button primary" type="button" onClick={onAction}><Plus size={18} />{action}</button></div> }

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) { useEffect(() => { const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose(); window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) }, [onClose]); return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="dialog" role="dialog" aria-modal="true" aria-label={title}><div className="dialog-head"><h2>{title}</h2><button className="icon-button" type="button" onClick={onClose} aria-label="关闭"><X size={19} /></button></div>{children}</div></div> }

function LegalDialog({ type, onClose }: { type: 'privacy' | 'terms'; onClose: () => void }) { return <Dialog title={type === 'privacy' ? '隐私说明' : '使用边界'} onClose={onClose}><div className="legal-copy">{type === 'privacy' ? <><p>发稿台默认在本机运行。标题、正文、排期与上传素材保存在项目目录中，不会由本项目主动上传到第三方服务器。</p><p>启用外部发布器后，任务会发送到你配置的 Webhook。请自行确认该服务的存储、日志与访问控制。</p></> : <><p>请只发布你有权使用的内容，并遵守小红书、今日头条的用户协议、版权规则与人工智能内容标识要求。</p><p>浏览器自动化可能触发验证码、限流或账号限制。不要用它批量制造重复内容，也不要尝试绕过平台安全验证。</p></>}<button className="button primary" type="button" onClick={onClose}>我知道了</button></div></Dialog> }

function Toast({ notice, onClose }: { notice: Exclude<Notice, null>; onClose: () => void }) { return <div className={cn('toast', notice.kind)} role="status">{notice.kind === 'success' ? <CheckCircle size={21} weight="fill" /> : <XCircle size={21} weight="fill" />}<span>{notice.message}</span><button type="button" onClick={onClose} aria-label="关闭提示"><X size={16} /></button></div> }

function LoadingScreen() { return <div className="loading-shell"><aside><div className="skeleton brand-skeleton" />{Array.from({ length: 5 }, (_, index) => <div className="skeleton nav-skeleton" key={index} />)}</aside><main><div className="skeleton heading-skeleton" /><div className="loading-grid"><div className="skeleton large-skeleton" /><div className="skeleton large-skeleton" /></div></main></div> }
function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) { return <main className="fatal-state"><div><WarningCircle size={38} /></div><h1>工作区没有启动</h1><p>{message}</p><button className="button primary" type="button" onClick={onRetry}><ArrowClockwise size={18} />重新连接</button></main> }

const sameDay = (left: Date, right: Date) => left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate()
const formatClock = (value?: string | null) => value ? new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) : ''
const formatWeekRange = (start: Date, end: Date) => `${new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(start)} 至 ${new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(end)}`

export default App
