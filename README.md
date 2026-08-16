# dsh 插件开发仓库

这个仓库用于维护一个或多个可安装的 **dsh 组合包（bundle）**。每个 `plugins/<name>` 目录都是一个独立的 npm 包，按 [插件打包与安装标准](docs/plugin-standard.md) 声明 `dsh.bundle.patch`，因此可以通过 `dsh plugin` 安装进任意 profile，而不必改 dsh 源码。

仓库根目录只是 pnpm workspace，不是一个插件。真正的插件、其 patch 层和构建产物都放在 `plugins/` 下。

## 目录

```
dsh-plugins/
├── docs/
│   └── plugin-standard.md      # 从 dsh 文档提炼的打包/安装规则
├── plugins/
│   ├── README.md               # 每个插件目录的结构与 manifest 约定
│   ├── hello-plugin/           # 最小可运行 TypeScript 模板
│   │   ├── package.json        # 声明 dsh.bundle.patch
│   │   ├── cordis.patch.yml    # 该 bundle 贡献的 patch 层
│   │   ├── src/index.ts        # 插件入口：export const name + apply()
│   │   ├── tests/hello.spec.js # node --test 冒烟测试
│   │   └── tsconfig.json
│   └── dsh-codex-files/        # Codex 桌面风格主题 + 右侧 Files 面板
├── package.json                # 私有 workspace 根，只有脚本
├── pnpm-workspace.yaml
└── tsconfig.base.json          # 共享的严格 ESM TypeScript 配置
```

## 快速开始

```powershell
pnpm install
pnpm run check
```

`pnpm run check` 会构建并测试 workspace 里的每个插件。

## 本地 dsh 类型镜像

`dsh-codex-files` 需要 `@deepseek-ai/*` 类型来通过 typecheck/build，而这些包并没有全部发布到公共 registry。它的 `dsh-dev/` 是本机 dsh checkout（默认是相邻的 `D:\deepseek-harness`）的本地镜像，已加入 `.gitignore`，不进入 git。

在这台机器上开发时保留该镜像即可。换一台机器 clone 后，先构建 dsh checkout，再重新生成镜像：

```powershell
node scripts/bootstrap-dsh.mjs --dsh D:\deepseek-harness
pnpm install
```

`bootstrap-dsh.mjs` 会扫描 dsh 的 `vendor/*`、`packages/*/*` 和 `native/landlock-run/packages/*`，把每个 `@deepseek-ai/*` 包的 `lib` 与重写后的 `package.json` 复制到 `plugins/dsh-codex-files/dsh-dev/ai/`；加 `--dry-run` 只列出计划，不写文件。

## 新增一个插件

1. 复制模板：

   ```powershell
   Copy-Item -Recurse plugins\hello-plugin plugins\my-plugin
   ```

2. 改三处标识：`package.json` 的 `name`、`cordis.patch.yml` 里的 `id` 与 `name`（指向包名）、`src/index.ts` 里的 `export const name`。

3. 按需替换 `src/index.ts` 的内容。真实插件应从 `@deepseek-ai/cordis` 导入 `Context`，并通过 `inject` 声明服务依赖、通过 `ctx.effect()` / `ctx.on()` 注册可回收的贡献；模板里的 `PluginContext` 只是免依赖的最小占位。

## 安装到 profile

本地源码直接链接：

```powershell
dsh plugin --profile web add D:\dsh-plugins\plugins\my-plugin
```

之后 `dsh --profile web` 会在 profile 的 bundle 层之后挂载该插件；先用 `dsh --profile web --dump-config` 检查这一层，再启动。

## 发布

- **git 安装**：源码 checkout 不会自动跑 `build`，插件必须提供自包含的 `prepare` 脚本；安装方还要在 profile 的 `pnpm-workspace.yaml` 里为对应包名授权 `allowBuilds`。
- **npm / tarball**：发布前先构建好 `lib/`；`pnpm pack` 打包后可以用 `dsh plugin add <tgz>` 安装。

细节见 [docs/plugin-standard.md](docs/plugin-standard.md)。
