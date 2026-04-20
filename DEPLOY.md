# Railway 部署指南

## 方式一：GitHub 自动部署（推荐）

### 步骤 1: 创建 GitHub 仓库

1. 在 GitHub 创建新仓库 `qianchuan-backend`
2. 将 `/workspace/qianchuan-manager-backend/api` 文件夹内容推送到仓库

### 步骤 2: 获取 Railway API Token

1. 登录 [Railway](https://railway.app)
2. 进入 Account Settings → Tokens
3. 创建新的 API Token

### 步骤 3: 配置 GitHub Secrets

在 GitHub 仓库的 Settings → Secrets 中添加：

| Secret Name | Value |
|-------------|-------|
| RAILWAY_TOKEN | 你的 Railway API Token |
| ACCESS_TOKEN | 2583e764d2a9e6cf6c6a89063f0b5d0a372c3a4a |
| REFRESH_TOKEN | 578026b11965dc99fb575c68d8deb62241341b65 |
| APP_ID | 1862954833036586 |
| APP_SECRET | 0b6957498fc6a2d0c507821a474c5a9f268cbfec |

### 步骤 4: 连接 Railway

1. 在 Railway Dashboard 创建新项目
2. 连接 GitHub 仓库
3. 自动部署

---

## 方式二：手动上传

### 步骤 1: 压缩代码

```bash
cd /workspace/qianchuan-manager-backend/api
zip -r qianchuan-backend.zip .
```

### 步骤 2: Railway 手动部署

1. 在 Railway Dashboard 点击 "New Project"
2. 选择 "Deploy from local files"
3. 上传压缩包
4. 配置环境变量

---

## 验证部署

部署成功后，测试以下端点：

```
GET https://your-railway-url.railway.app/health
GET https://your-railway-url.railway.app/api/advertiser-mapping
```

预期返回：
- health: `{"status":"ok","timestamp":"..."}`
- advertiser-mapping: `{"shops":[...],"totalQianchuan":55}`
