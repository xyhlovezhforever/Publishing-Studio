# 发稿台 Publishing Studio

本地运行的多平台内容编辑与发布调度台。它把内容、素材、账号备注、排期、任务状态和运行记录放到一个工作区，并通过 Webhook 将真实发布交给独立执行器。

## 当前能力

- 小红书图文和今日头条文章的独立预览
- 一份内容同时创建多个平台任务
- 立即发布、定时发布、取消和失败重试
- 七天排期日历、队列筛选和运行记录
- 本地 JSON 持久化与图片、视频上传
- 默认模拟发布，不会访问真实平台
- 外部 Webhook 模式，用于接入开源发布器
- 六个候选开源项目的能力与许可证目录

## 运行

需要 Node.js 20 或更高版本。

```powershell
npm install
npm run dev
```

打开 `http://127.0.0.1:4173`。

生产构建：

```powershell
npm run build
npm start
```

测试：

```powershell
npm test
```

## 架构边界

发稿台负责统一内容模型、规则检查、排期和任务状态。真实平台登录与浏览器自动化由独立发布器负责：

```text
React 工作台 -> Express 队列 -> 标准 Webhook -> 独立发布器 -> 平台
```

这样做有三个原因：

1. 平台登录态不会进入网页前端。
2. 平台页面变更时只需要更新对应适配器。
3. GPL 项目可以保持为独立进程，避免与主程序源码混合。

截图中的项目被视为候选执行器，不会自动下载或复制到本项目：

| 项目 | 主要用途 | 建议角色 | 截图标注许可证 |
| --- | --- | --- | --- |
| XiaohongshuSkills | 小红书图文、视频 | 小红书专用连接器 | MIT |
| social-auto-upload | 多平台图文、视频 | 默认自动化候选 | MIT |
| Wechatsync | 多平台文章同步 | 文章同步独立服务 | GPL 3.0 |
| toutiao-publish | 头条文章、微头条 | 头条专用连接器 | MIT |
| MatrixMedia | 批量多账号发布 | 批量发布独立服务 | GPL 2.0 |
| MultiPublish | Windows 视频发布 | 桌面端候选 | MIT |

正式接入前应以各仓库最新 LICENSE 和平台协议为准。

## Webhook 接口

复制 `.env.example` 为 `.env`，设置发布器地址：

```dotenv
PORT=4173
PUBLISH_MODE=webhook
PUBLISHING_STUDIO_URL=http://127.0.0.1:4173
XHS_WEBHOOK_URL=http://127.0.0.1:5101/publish
TOUTIAO_WEBHOOK_URL=http://127.0.0.1:5102/publish
WEBHOOK_TOKEN=replace-with-a-local-secret
```

任务请求使用 `POST`，正文为 JSON：

```json
{
  "job": {
    "id": "任务编号",
    "platform": "xiaohongshu",
    "scheduledAt": "2026-10-29T12:00:00.000Z"
  },
  "post": {
    "title": "标题",
    "content": "正文",
    "tags": ["内容运营"],
    "media": [
      {
        "name": "cover.jpg",
        "url": "/uploads/文件名.jpg",
        "type": "image/jpeg"
      }
    ]
  },
  "account": {
    "id": "account_xhs",
    "name": "小红书测试号"
  }
}
```

发布器成功后返回：

```json
{
  "id": "平台内容编号",
  "message": "小红书发布完成"
}
```

非 2xx 响应会被记录为失败任务，可在队列中重试。当前 `WEBHOOK_TOKEN` 作为 Bearer Token 发送；生产环境还应增加请求签名、幂等键、回调鉴权和素材绝对地址转换。

## 数据与安全

- 内容保存在 `data/store.json`。
- 上传文件保存在 `uploads/`。
- 默认监听 `127.0.0.1`，不会暴露到局域网。
- 模拟模式只生成本地成功记录。
- 不要将平台密码或 Cookie 写入本项目。
- 请只发布有权使用的内容，并遵守平台的自动化、版权和人工智能内容标识要求。
