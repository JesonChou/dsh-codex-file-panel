# plugins

`plugins/<name>` 是 workspace 的成员，也是一个个独立 npm 包。每个插件都遵守 [docs/plugin-standard.md](../docs/plugin-standard.md)。

## 每个插件目录

```
plugins/<name>/
├── package.json       # 必须声明 dsh.bundle.patch；main 指向入口
├── cordis.patch.yml   # 本 bundle 的 patch 层
├── src/               # TypeScript 源码
├── tests/             # node --test 冒烟测试
├── tsconfig.json      # 继承根 tsconfig.base.json
└── README.md
```

## manifest 约定

- `name` 用 `dsh-<name>`，与 `cordis.patch.yml` 里的 `name` 一致。
- `main` 指向构建后的入口（模板是 `lib/index.js`）；`files` 至少包含入口目录和 `cordis.patch.yml`。
- `dsh.bundle.patch` 必须存在，否则 `dsh plugin add` 只把它当普通依赖。
- 真实插件通过 `export const inject = [...]` 声明服务依赖；不要手动控制加载顺序。

## TypeScript 与真实 dsh 类型

模板为了保持零依赖，用本地 `PluginContext` 占位。正式插件应替换成：

```ts
import type { Context } from '@deepseek-ai/cordis'
```

并在开发依赖里接入本地 dsh checkout（`@deepseek-ai/*` 包并未全部发布到公共 registry）。接入方式与 `dsh-codex-files` 一致：把需要的 `@deepseek-ai/*` 包链接或复制进来，再在 `tsconfig` 里配置路径。加入这些类型后再把 `PluginContext` 换掉。
