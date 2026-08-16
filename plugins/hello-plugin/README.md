# dsh-hello-plugin

最小可运行的 dsh bundle 模板：加载时打印一条日志，并注册一个卸载时回收的 effect。它演示的是标准插件入口，不是真实功能。

## 文件

- `cordis.patch.yml` — profile 挂载本 bundle 时应用的 patch 层。
- `src/index.ts` — 命名导出 `name` 与 `apply`。
- `tests/hello.spec.js` — 构建后对入口做冒烟测试。

## 构建与测试

```powershell
pnpm -C plugins/hello-plugin run check
```

或从仓库根执行 `pnpm run check`。

## 安装

```powershell
dsh plugin --profile web add D:\dsh-plugins\plugins\hello-plugin
```
