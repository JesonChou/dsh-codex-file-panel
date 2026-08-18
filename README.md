# dsh-codex-file-panel

[![CI](https://github.com/JesonChou/dsh-codex-file-panel/actions/workflows/ci.yml/badge.svg)](https://github.com/JesonChou/dsh-codex-file-panel/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web UI 提供 Codex 风格的工作区文件侧栏。

它把文件树、搜索、编辑、预览与 Git review 集中到右侧面板，并补充底部终端等与文件工作流紧密相关的能力。项目按照 Harness 官方 bundle 规范组织，仓库根目录本身就是可由 `dsh plugin add` 安装的插件包。

> [!IMPORTANT]
> 这是社区维护的第三方项目，不属于 DeepSeek 或 OpenAI。Codex 名称仅用于说明UI交互风格。

## 功能

- Codex 风格的可调整宽度右侧文件面板，支持响应式收起与布局持久化。
- 工作区文件树、文件名搜索、文本读取与保存。
- Markdown、代码、图片、音视频和 PDF 预览；PDF 资源由插件本地提供。
- Git 变更查看、暂存、取消暂存和提交。
- 会话级多标签终端，支持断线短暂保活和尺寸同步。
- 与 Harness 原生会话、语言包、布局和 client module loader 集成。
- 中英文界面文案。

## 兼容性

| 组件 | 要求 |
| --- | --- |
| DeepSeek Harness | `0.1.0-rc.7` 系列 API |
| Node.js | 22 或更高版本 |
| 开发包管理器 | pnpm 11（仓库锁定 `11.21.0`） |
| 运行界面 | Harness Web UI |

插件依赖 `node-pty` 原生模块。Windows、macOS 和 Linux 均应使用与本机 Node.js ABI 匹配的构建产物。

## 安装

### 从 GitHub 安装

安装 `main` 分支的最新源码：

```sh
dsh plugin --profile web add github:JesonChou/dsh-codex-file-panel
```

`main` 会继续变化。需要可复现安装时，请固定到经过审计的 tag 或完整 commit SHA：

```sh
dsh plugin --profile web add github:JesonChou/dsh-codex-file-panel#<tag-or-commit-sha>
```

Git 安装获取的是源码，因此包内的 `prepare` 会构建 `lib/`。pnpm 10 及以上默认阻止依赖执行构建脚本；首次 `add` 可能先失败，并在目标 profile 的 `pnpm-workspace.yaml` 中生成待确认项。请按终端输出的精确包键授权，例如：

```yaml
allowBuilds:
  dsh-codex-file-panel: true
  node-pty: true
```

保存后重新执行同一条 `add` 命令。这项授权允许依赖在沙箱外执行本机代码，只应对已审计且固定 commit 的源码开放。

### 从本地 checkout 安装

克隆仓库并在根目录执行：

```sh
git clone https://github.com/JesonChou/dsh-codex-file-panel.git
cd dsh-codex-file-panel
corepack enable
pnpm install --frozen-lockfile
dsh plugin --profile web add .
```

### 从 tarball 安装

tarball 包含预构建的 JavaScript，不需要为插件本身授权 `prepare`；`node-pty` 仍可能需要本机构建授权。

```sh
pnpm install --frozen-lockfile
pnpm pack --pack-destination dist
dsh plugin --profile web add ./dist/dsh-codex-file-panel-0.4.0.tgz
```

### 验证与启动

```sh
dsh --profile web --dump-config
dsh --profile web
```

第一条命令的输出应包含 `# == dsh-codex-file-panel` 层。卸载命令：

```sh
dsh plugin --profile web remove dsh-codex-file-panel
```

### 升级

跟随 `main` 安装的用户可以让 pnpm 更新 Git 依赖：

```sh
dsh plugin --profile web update dsh-codex-file-panel
```

固定 tag/SHA 的用户应重新执行 `add`，并把 URL fragment 改为目标 tag 或 commit；更新后再次运行 `dsh --profile web --dump-config` 检查组合层。

## 配置

插件提供文件传输上限、终端数量、终端 shell、断线保活时间和目录排除项。默认值适合本地开发；完整字段、默认值与 profile 覆盖示例见 [配置文档](docs/configuration.md)。

## 安全边界

插件具备读取和写入会话工作区、执行 Git 操作以及创建本机 PTY 的能力。服务端路由会限制路径不能逃逸会话 `cwd`、限制载荷大小并拒绝非 loopback 来源，但仍应只在可信的本地 Harness 环境中使用。

不要未经认证地把 Web UI 暴露到公网，也不要假设反向代理后的 loopback 检查等同于用户认证。安全问题请按 [SECURITY.md](SECURITY.md) 私下报告。

## 开发

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm run check
```

`check` 依次执行严格 TypeScript 检查、Node/浏览器双入口构建、Vitest 测试、浏览器 module table 冒烟测试和包结构校验。

常用命令：

| 命令 | 用途 |
| --- | --- |
| `pnpm run build` | 构建 `lib/index.js`、声明文件和 `lib/client.js` |
| `pnpm run typecheck` | 检查 Node 与浏览器源码 |
| `pnpm test` | 运行全部自动化测试 |
| `pnpm run test:watch` | 监听模式运行测试 |
| `pnpm run verify` | 校验 bundle 和发布包约束 |
| `pnpm run e2e:pdf` | 对已启动的本地 Harness 执行 PDF 管线测试 |

E2E 脚本默认连接 `http://127.0.0.1:3080` 并使用当前目录，可通过 `DSH_E2E_BASE_URL` 与 `DSH_E2E_CWD` 覆盖。

## 仓库结构

```text
.
├── .github/                 # CI、Dependabot、Issue 与 PR 模板
├── docs/                    # 配置、打包规范和布局契约
├── scripts/                 # 构建产物、包结构和 E2E 校验
├── src/
│   ├── client/              # Web UI 文件面板与工作台界面
│   ├── index.ts             # Harness 服务端插件入口
│   └── pty-manager.ts       # 会话终端生命周期
├── tests/                   # 单元、组件和 bundle 冒烟测试
├── cordis.patch.yml         # dsh.bundle 提供的配置层
├── package.json             # bundle/client manifest 与发布元数据
└── tsdown.config.ts         # Node + 浏览器双入口构建
```

打包约束见 [插件打包规范](docs/plugin-standard.md)，可观察布局依据见 [Codex Desktop 布局契约](docs/codex-desktop-layout-contract.md)。

## 参与贡献

提交前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。面向用户的变化应同步更新 [CHANGELOG.md](CHANGELOG.md)。

## 许可证

[MIT](LICENSE)
