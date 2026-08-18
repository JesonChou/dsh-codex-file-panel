# Changelog

本项目的重要变更记录在此文件中。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Changed

- 补充真实 GitHub 仓库地址、安装/升级命令和 npm 包仓库元数据。

## [0.4.0] - 2026-08-18

### Added

- 根级 DeepSeek Harness bundle manifest、GitHub 源码安装 `prepare` 和发布包校验。
- GitHub Actions、Dependabot、Issue/PR 模板以及贡献、安全和行为准则。
- 完整的安装、配置、开发、打包与安全边界文档。

### Changed

- 项目与 npm 包统一更名为 `dsh-codex-file-panel`，明确表达“Codex 风格的 DSH 文件侧栏”。
- 从多包示例 workspace 重构为单一、可直接安装的插件仓库。
- 开发依赖改用 npm 已发布的 Harness `0.1.0-rc.7` 包，不再依赖本机 `dsh-dev` 镜像。

### Removed

- `hello-plugin` 示例包、通用 workspace 说明和本机 Harness 镜像引导脚本。

[Unreleased]: https://github.com/JesonChou/dsh-codex-file-panel/compare/c4f6e2b002897205e24f943ab250ff496345759e...HEAD
[0.4.0]: https://github.com/JesonChou/dsh-codex-file-panel/commit/c4f6e2b002897205e24f943ab250ff496345759e
