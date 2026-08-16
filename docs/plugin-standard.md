# 插件打包与安装标准

以下规则提炼自 dsh 源码里的 `docs/user/develop/basic/publish.md`。开发本仓库的插件前先读完那份原文；这里只保留日常开发必须记住的部分。

## 两种 manifest

dsh 用两种 package.json manifest 区分「贡献配置」和「启动配置」，同一个包不能同时是两者：

- **bundle**：声明 `dsh.bundle`，回答“这个包贡献什么”。它是带一个 patch 层的 npm 包。
- **profile**：声明 `dsh.profile`，回答“哪些 bundle 按什么顺序组成一套配置”。它位于 `$DSH_HOME/profiles/<name>`。

本仓库只产出 bundle。

## 一个 bundle 的最小结构

```
hello-plugin/
├── package.json       # 声明 dsh.bundle.patch
├── cordis.patch.yml   # profile 挂载这个 bundle 时应用的层
└── index.js           # patch 行引用的插件入口（TS 则是 lib/index.js）
```

`package.json` 的必需部分：

```json
{
  "name": "dsh-hello-plugin",
  "version": "0.1.0",
  "type": "module",
  "main": "index.js",
  "files": ["index.js", "cordis.patch.yml"],
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } }
}
```

插件入口命名导出 `apply`，Cordis 加载时调用它并传入 `ctx`；`name` 是可选显示元数据。

## patch 层

`cordis.patch.yml` 的顶层是一个 YAML 数组，条目是 `--patch` overlay 使用的同一套 `PatchOptions`。与 overlay 的区别是：行里的 `name` 写**包名**而不是相对源码路径，这样 Node 能按普通模块解析找到已安装的代码：

```yaml
- insert:
    - id: hello
      name: dsh-hello-plugin
```

没有 `dsh.bundle` 声明的包仍可安装，但只会作为普通依赖，不激活任何层。

## 层顺序

生效配置从空根开始，按以下顺序应用：

1. profile 的 `dsh.profile.bundles` 列表，按列表顺序。
2. profile 自己的 `cordis.patch.yml`。
3. home 级 `$DSH_HOME/cordis.patch.yml`。
4. 每个 `--patch <path>` overlay，按 argv 顺序。

后层胜出；按 `id` 覆盖时要重述该行需要的全部键，而不是只写改动项。

## 安装

```sh
dsh plugin --profile <name> add <path | github:owner/repo | npm-package | tarball>
dsh plugin --profile <name> remove <package>
```

## git 安装的构建脚本

git 安装拉取的是源码，不会跑 `build`，TypeScript 包会缺 `lib/` 导致加载失败：

- **作者**必须提供自包含的 `prepare` 脚本，从源码构建出发布入口，不能依赖旁边的 monorepo checkout。
- **用户**要为安装时执行代码授权：pnpm ≥10 默认拒绝 git 依赖的 `prepare`，首次 `add` 失败后，把 pnpm 打印的包键写进 profile 的 `pnpm-workspace.yaml`：

  ```yaml
  allowBuilds:
    dsh-hello-plugin: true
  ```

  然后重新 `add`。这份授权意味着允许该包代码在安装时于本机执行，只对可信源码开放，并锁定 commit。

## 免构建分发

不想让用户做 `allowBuilds` 授权，就分发构建产物：

- 发布到 npm：`pnpm publish` 时已带 `lib/`。
- 交付 tarball：`pnpm pack` 后用 `dsh plugin add ./<pkg>-<version>.tgz` 安装。
