# Changelog

## 0.1.1

- Fix: 拡張が起動時に失敗し `command 'kiroMcpSwitcher.switchProfile' not found` になる不具合を修正。
  jsonc-parser がバンドルに取り込まれていなかったため、esbuild を ESM エントリ優先に変更した。

## 0.1.0

- Initial release.
- Sidebar view listing MCP profiles and servers.
- One-click enable/disable of individual servers.
- Named profiles (save the current on/off combination, switch between them).
- Status bar item showing the active profile and target.
- Selectable target: workspace (`.kiro/settings/mcp.json`) or user (`~/.kiro/settings/mcp.json`).
- Surgical JSON edits that preserve comments and formatting.
