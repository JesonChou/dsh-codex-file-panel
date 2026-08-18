# DeepSeek Harness 插件打包规范

本文记录本仓库遵循的发布约束。权威来源是 DeepSeek Harness 官方文档的 [打包与安装插件](https://deepseek-harness.github.io/deepseek-harness/develop/basic/publish)；官方行为变化时应以原文为准。

## Bundle 与 profile

Harness 使用两种不同 manifest：

- bundle 是作者分发的 npm 包，通过 `package.json` 的 `dsh.bundle` 声明自己贡献的配置层。
- profile 是用户机器上由 `dsh plugin` 管理的可运行组合，通过 `dsh.profile.bundles` 记录 bundle 顺序。

一个包不能同时是 bundle 和 profile。本仓库只产出 bundle，绝不手写或发布用户 profile。

## 本仓库的发布结构

```text
dsh-codex-file-panel/
├── package.json
├── cordis.patch.yml
├── lib/
│   ├── index.js
│   ├── index.d.ts
│   └── client.js
├── README.md
└── LICENSE
```

源码仓库还包含 `src/`、`tests/`、`scripts/` 和 GitHub 社区文件，但 `package.json#files` 只把运行必需内容放进 npm/tarball。

## Manifest

关键字段如下：

```json
{
  "name": "dsh-codex-file-panel",
  "type": "module",
  "main": "./lib/index.js",
  "files": ["lib", "cordis.patch.yml", "README.md", "LICENSE"],
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "inject": [
        "@deepseek-ai/dsh-client-runtime",
        "@deepseek-ai/dsh-client-locale",
        "@deepseek-ai/dsh-client-ui-conversation"
      ],
      "platform": "web"
    }
  }
}
```

没有 `dsh.bundle` 的包仍会成为 profile 依赖，但不会贡献任何配置层。`dsh.client` 是本插件浏览器入口所需的 client module 元数据。

## Patch 层

`cordis.patch.yml` 顶层是 patch 数组。插件行按 npm 包名解析，不能写仓库相对路径：

```yaml
- insert:
    - id: dsh-codex-file-panel
      name: dsh-codex-file-panel
```

配置应用顺序为：profile bundle 列表、profile 自身 patch、home 级 patch、命令行 `--patch`。后层按行覆盖前层，行内 `config` 会整体替换而不是深度合并，因此用户覆盖插件行时必须重述全部需要的字段。

## GitHub 源码安装

Git 依赖下载源码而不是 `lib/`。本包因此声明自包含的 `prepare: tsdown`，其开发依赖全部来自 npm registry，不依赖旁边的 monorepo 或本地 Harness checkout。

pnpm 10 及以上需要用户在目标 profile 中明确允许这个 `prepare`。授权意味着安装阶段可在 agent 沙箱外执行包代码，因此文档要求固定 commit，并只安装可信源码。

## npm 与 tarball

`prepack` 会运行完整 `check`，确保被发布的入口已经构建并通过测试。发布前应执行：

```sh
pnpm install --frozen-lockfile
pnpm run check
pnpm pack --pack-destination dist
```

tarball 内容必须包含：

- `package.json`
- `cordis.patch.yml`
- `lib/index.js`
- `lib/index.d.ts`
- `lib/client.js`
- `README.md`
- `LICENSE`

不得包含测试、未编译源码、本地凭据、profile 配置、`node_modules` 或构建机绝对路径。

## 发布检查清单

- package 名、Cordis `id`、patch `name`、Node/client `name` 与 client loader ID 一致。
- `dsh.bundle.patch` 指向实际随包发布的文件。
- `prepare` 能在只有 registry 依赖的干净 checkout 中完成。
- peer dependency 范围与目标 Harness 版本一致。
- `pnpm run check` 在 Windows 与 Linux CI 通过。
- `pnpm pack` 的文件列表符合上节约束。
- CHANGELOG、README 兼容性说明和版本号已经更新。
