# Supabase 认证与本地开发（邮件确认流程）

## Authentication → URL Configuration

1. **Site URL**：`http://localhost:3002`（与 `npm run dev` 端口一致）
2. **Redirect URLs**（Additional Redirect URLs）中增加：
   - `http://localhost:3002/auth/callback`
   - `http://localhost:3002/**`（可选，便于多路径）

## Email Templates

在 **Authentication → Email Templates → Confirm signup**：

- 使用官方默认模板即可（链接里会包含 `token_hash` / `type` / `redirect_to` 等查询参数）。
- 在 **Authentication → URL Configuration** 里把 **Redirect URLs** 配好（见上），确认邮件中的跳转目标才会被允许指向 `http://localhost:3002/auth/callback`。

若模板里有可编辑的 **Redirect URL** / **Site URL** 占位，请指向：`http://localhost:3002/auth/callback`（与 Redirect URLs 白名单一致）。

## 行为说明

- 用户提交注册后仅提示「验证邮件已发送」，不跳转。
- 点击邮件链接 → PKCE `code` → `/auth/callback` 换 session → 调用 `provision_new_user()` 创建组织与预置 Agent → 跳转 `/onboarding`。
- **关闭邮箱确认**（仅开发环境）时，注册成功会跳转 `/auth/complete-registration` 完成同样初始化。

生产环境部署时，请把 **Site URL** 与 **Redirect URLs** 改为生产域名，并在注册 `signUp` 中使用 `emailRedirectTo: ${origin}/auth/callback`。
