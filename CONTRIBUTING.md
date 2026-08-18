# 贡献指南

感谢你改进 `dsh-codex-file-panel`。小型修复可以直接提交 Pull Request；涉及公共 API、依赖、权限边界或大幅界面变化的改动，建议先创建 Issue 说明目标和取舍。

参与项目即表示你同意遵守 [行为准则](CODE_OF_CONDUCT.md)。安全问题不要公开提交，请按 [SECURITY.md](SECURITY.md) 报告。

## 开发环境

需要 Node.js 22+ 和 pnpm 11。仓库使用 Corepack 锁定 pnpm 版本：

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm run check
```

官方 Harness 类型依赖来自 npm registry，不需要相邻的 DeepSeek Harness 源码仓库。

## 工作方式

1. 从 `main` 创建短生命周期分支。
2. 只处理一个主题，并为行为变化增加或更新测试。
3. 保持 Node 入口与浏览器入口的插件名、路由和 bundle ID 一致。
4. 用户可见变化更新 README/配置文档和 CHANGELOG 的 `Unreleased`。
5. 提交前运行 `pnpm run check`。

推荐使用 Conventional Commits 风格，例如：

```text
feat(panel): add filename filters
fix(terminal): dispose disconnected pty
docs: clarify git installation
```

## 界面贡献

本项目追求可观察的 Codex 风格交互，但不复制专有源码、图标或品牌资源。布局改动应：

- 在不同窗口宽度下验证文件面板、会话区和底部终端。
- 保持键盘操作、焦点态与 reduced-motion 体验可用。
- 更新 [布局契约](docs/codex-desktop-layout-contract.md) 中受影响的行为。
- 为纯布局算法优先增加无浏览器单元测试，为交互增加 Testing Library 测试。

## 服务端贡献

文件、Git 和终端端点属于高权限能力。改动必须维持：

- 所有文件路径限制在会话 `cwd` 内。
- 请求大小、读取大小和缓冲区有明确上限。
- loopback 来源检查不会被无意移除。
- Cordis effect 卸载时释放路由、WebSocket、PTY 和监听器。
- 错误返回稳定的类型码，不泄露不必要的本机信息。

## Pull Request 检查清单

- PR 描述解释问题、方案、风险和验证方式。
- 自动化测试和 `pnpm run check` 通过。
- 不包含生成的 `lib/`、`node_modules/`、凭据或本机绝对路径。
- 新依赖确有必要，许可证与供应链风险已检查。
- 破坏性变化明确标记，并附迁移说明。

维护者可能要求拆分过大的 PR，以便审查和回滚。
