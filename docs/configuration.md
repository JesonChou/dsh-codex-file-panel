# 配置

`dsh-codex-file-panel` 通过 Cordis schema 提供以下配置。所有字节值均按 UTF-8/原始文件字节计算。

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | ---: | --- |
| `maxReadBytes` | number | `2097152` | 单次文本读取上限，范围 1 KiB–64 MiB |
| `maxWriteBytes` | number | `2097152` | 单次文本写入上限，范围 1 KiB–64 MiB |
| `maxRawBytes` | number | `33554432` | PDF、图片等原始预览上限，范围 1 KiB–256 MiB |
| `maxTerminalsPerSession` | number | `3` | 每个会话可创建的终端标签数，范围 1–12 |
| `terminalReconnectGraceMs` | number | `5000` | WebSocket 断开后终端等待重连的时间，范围 0–60000 ms |
| `terminalShell` | string | `""` | 终端 shell；空字符串表示使用平台默认值 |
| `excludeDirs` | string[] | 见下方 | 文件树和搜索跳过的目录名 |

默认排除目录：

```json
[
  "node_modules",
  ".git",
  "dist",
  "build",
  ".dsh",
  ".next",
  ".turbo",
  "coverage",
  "__pycache__"
]
```

## 在 profile 中覆盖

把完整插件行写入目标 profile 的 `cordis.patch.yml`。后层会整体替换前层的 `config`，因此建议明确写出所有希望长期固定的值：

```yaml
- insert:
    - id: dsh-codex-file-panel
      name: dsh-codex-file-panel
      config:
        maxReadBytes: 4194304
        maxWriteBytes: 4194304
        maxRawBytes: 67108864
        maxTerminalsPerSession: 4
        terminalReconnectGraceMs: 5000
        terminalShell: ''
        excludeDirs:
          - node_modules
          - .git
          - dist
          - build
          - coverage
```

修改后先检查组合结果：

```sh
dsh --profile web --dump-config
```

## 安全建议

- 不要为了方便而把读写上限设置得远高于实际需要。
- 自定义 `terminalShell` 必须是本机可信可执行文件。
- `excludeDirs` 只影响界面展示和搜索，不是访问控制机制。
- 路径限制以会话 `cwd` 为边界；请为会话选择最小必要工作目录。
