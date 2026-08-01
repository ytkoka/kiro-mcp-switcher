# Changelog

## 0.2.4

- Guard against accidental data loss with empty presets: applying an empty preset now asks for
  confirmation (it would clear mcp.json), and saving a preset while mcp.json has no servers asks
  before creating an empty preset. Empty presets are marked "empty" with a warning icon in the tree.

## 0.2.3

- Docs: update the README Install section for the published extension — install from the
  Extensions view (Open VSX), with VSIX as the offline/manual alternative.

## 0.2.1

- Focus the extension on **Config Presets**. The old **Profiles** feature (enable/disable
  combinations) has been **removed** — presets cover the switching use case, and the obsolete
  `kiroMcpSwitcher.profiles` setting is cleaned up automatically on activation.
- Replace the flat "Servers" list with an **Active Config** view: expand each server in the
  current mcp.json to inspect its full entry (`command`, `args`, `url`, `headers`, `env`, …).
- **Sensitive values are masked** by default (Authorization, token, key, secret, password, …);
  toggle visibility with the eye icon in the view title or `kiroMcpSwitcher.maskSensitiveValues`.

## 0.2.0

- Add Config Presets: named presets, each a complete `mcpServers` definition stored as files
  under `<settings>/mcp-presets/`. Applying swaps the mcp.json `mcpServers` block wholesale
  (other keys and comments preserved) so Kiro sees exactly that preset's servers.
- Save-current / new-empty / duplicate; automatic pre-apply snapshot with Restore Last Snapshot;
  one-click Window Reload after apply. New "Config Presets" sidebar section.

## 0.1.0

- Initial release: sidebar view, per-server enable/disable, named profiles, workspace/user target.
