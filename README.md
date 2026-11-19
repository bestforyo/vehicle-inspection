# 鉴见 · 车辆检测 SaaS

面向车辆检测机构的多租户检测工作台，包含检测师微信小程序、响应式机构后台、平台运营后台、NestJS API 和无登录只读报告 H5。

前端预览：`https://bestforyo.github.io/vehicle-inspection/`。预览由 GitHub Pages 自动部署；生产 API 与 PostgreSQL 需按下方部署章节单独配置。

## 已实现

- 国标/团标下三非、四非、整车、新车八套动态模板；摩托车与新能源创建入口关闭。
- 订单幂等创建、模板修订快照、车辆资料 AES-256-GCM 加密、草稿乐观锁和离线暂存。
- 关键项尺寸判定、条件说明、异常照片、事故/泡水/火烧提示。
- 检测提交冻结、管理员退回修订、禁止自审、事务内审核发布。
- 不可变报告快照、脱敏公开字段、256-bit 分享令牌、哈希存储、到期和撤销。
- 机构资料、成员与两种业务角色、模板专业复核、平台机构开通及操作审计。
- Taro 4 微信小程序、微信登录绑定、拍照上传和报告分享。

## 工程结构

```text
apps/
  api/                    NestJS + Prisma + PostgreSQL
  web/                    React + Vite，机构/平台后台及公开报告 H5
  inspector-miniapp/      Taro 4 + React + TypeScript
packages/
  contracts/              共享类型、状态和业务枚举
  templates/              模板目录、答案校验和异常提示规则
infra/
  docker/                 本地 PostgreSQL / Redis
  migrations/             可选 RLS 纵深防护策略
```

## 本地运行

要求 Node.js 22+、npm 11+。Docker 仅用于本地数据库和 Redis，不是应用运行前提。

```powershell
npm.cmd install
Copy-Item apps/api/.env.example apps/api/.env
# 修改 .env 中的数据库地址和所有随机密钥
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
npm.cmd run dev
```

如果使用 `infra/docker/docker-compose.yml` 启动数据库，请先启动容器，再执行迁移。开发服务器默认：

- Web：`http://localhost:5173`
- API：`http://localhost:3000`
- OpenAPI：`apps/api/openapi.yaml`

演示账号仅用于虚构数据环境：

| 角色 | 邮箱 | 初始密码 |
|---|---|---|
| 检测师 | `inspector@demo.jianjian.cn` | `Inspector123!` |
| 机构管理员 | `admin@demo.jianjian.cn` | `Admin123!` |
| 平台运营 | `platform@demo.jianjian.cn` | `Platform123!` |

生产环境必须设置 `SEED_DEMO=false`，不得使用上述账号、密码或示例密钥。

## 微信小程序

```powershell
npm.cmd run dev:weapp -w @jianjian/inspector-miniapp
npm.cmd run build -w @jianjian/inspector-miniapp
```

使用微信开发者工具导入 `apps/inspector-miniapp`，构建产物在 `dist/`。开发体验使用 `touristappid`；正式发布须替换为机构小程序 AppID，在服务端配置 `WECHAT_APP_ID / WECHAT_APP_SECRET`，并在微信公众平台配置 API、上传和下载域名。先在成员账号中绑定微信，再使用一键登录。

## 验证

```powershell
npm.cmd run build
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
```

真实 PostgreSQL 端到端测试：

```powershell
$env:TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/jianjian_e2e"
npm.cmd run prisma:deploy
npm.cmd run test:e2e
```

E2E 会创建订单、上传异常照片、提交、退回、重新提交、发布、分享、撤销并验证跨租户隔离。请使用可清空的独立测试库，不要指向生产数据库。

## 环境变量

最少生产配置见 `apps/api/.env.example`：

- `DATABASE_URL`：独立 PostgreSQL 数据库。
- `JWT_SECRET`、`REPORT_SHARE_HASH_KEY`、`VEHICLE_DATA_ENCRYPTION_KEY`：三个独立高熵密钥。
- `PUBLIC_REPORT_BASE_URL`：公开 Web 地址加 `/r`，例如 `https://report.example.com/r`。
- `CORS_ORIGINS`：Web 域名白名单，逗号分隔。
- `UPLOAD_DIR`：持久化私有媒体目录；多实例部署时应替换为私有对象存储适配器。
- `WECHAT_APP_ID / WECHAT_APP_SECRET`：仅服务端保存。
- `SEED_DEMO=false`：禁止生产演示数据。

`.env` 已忽略，不得提交生产密钥、真实 VIN、车主资料或现场照片。

## 部署

### Docker API

```bash
docker build -f infra/docker/Dockerfile.api -t jianjian-api .
docker run --env-file apps/api/.env -p 3000:3000 jianjian-api
```

发布前先执行 `npm run prisma:deploy`，再启动新容器。迁移只采用向前兼容方式；回滚程序不得删除已生成的检测修订、正式报告或审计记录。

### Render Blueprint

`render.yaml` 提供 API、PostgreSQL 和静态 Web 的部署蓝图。首次部署后：

1. 把 Web 的 `VITE_API_BASE_URL` 设置为 API 公网地址。
2. 把 API 的 `PUBLIC_REPORT_BASE_URL` 设置为 `https://<web-domain>/r`。
3. 把 API 的 `CORS_ORIGINS` 设置为 Web 域名。
4. 配置持久化磁盘或私有对象存储，执行数据库备份与恢复演练。
5. 使用随机生产密钥，关闭演示种子，完成专业人员模板复核。

### Vercel 静态 Web

仓库根目录包含 `vercel.json`。部署时设置 `VITE_API_BASE_URL` 为独立 API 地址；Vercel 静态托管本身不提供 PostgreSQL、持久媒体或 NestJS 常驻服务。

## CI

`.github/workflows/ci.yml` 在 PostgreSQL 17 服务上执行依赖安装、lint、类型检查、单元测试、全部构建、迁移和 E2E。依赖审计单独报告；Taro 上游依赖仍有已知公告，升级前须完成小程序兼容回归，不能通过降级或忽略 peer 依赖假装修复。

## 生产边界与待确认事项

- 当前模板是产品种子，不是 GB/T 30323-2013 或团标完整合规清单。规格中的内饰表实际只列出 22 项，为保持 24 项结构补入的左后/右后安全带仍标记为待专业确认。
- 本地私有媒体实现适合单实例；生产多实例、CDN、病毒扫描、异步转码和对象存储签名上传仍需接入所选云厂商。
- RLS 脚本作为纵深防护提供，启用前必须为 API 配置每事务租户变量并使用非表所有者数据库角色；当前强制隔离主要由服务端租户查询实现。
- 微信体验版、正式域名、标准授权、专业审核、MFA、监控告警、备份恢复、对象存储和第三方车辆查询供应商需要机构账号与配置后才能完成真实上线验收。
