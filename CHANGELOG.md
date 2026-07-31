# Changelog

## 0.2.1

- Focus on Config Presets; remove the old Profiles feature (enable/disable combos) and clean up
  the obsolete `kiroMcpSwitcher.profiles` setting on activation.
- Replace the "Servers" list with an "Active Config" view: expand each server to inspect its full
  mcp.json entry (command, args, url, headers, env, ...).
- Mask sensitive values by default (Authorization, token, key, secret, password, ...); toggle with
  the eye icon or `kiroMcpSwitcher.maskSensitiveValues`.

## 0.2.0

- Add Config Presets: named presets, each a complete `mcpServers` definition stored as files
  under `<settings>/mcp-presets/`. Applying swaps the mcp.json `mcpServers` block wholesale
  (other keys and comments preserved) so Kiro sees exactly that preset's servers.
- Save-current / new-empty / duplicate; automatic pre-apply snapshot with Restore Last Snapshot;
  one-click Window Reload after apply. New "Config Presets" sidebar section.

## 0.1.2

- Fix: ツリーのインライン/コンテキストのボタン（プロファイル Apply、サーバー切替、プロファイル削除）が
  ツリー要素オブジェクトを受け取って動作しない不具合を修正。ステータスバーの
  "[object Object]" 表示と、プロファイルが切り替わらない問題を解消した。

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
