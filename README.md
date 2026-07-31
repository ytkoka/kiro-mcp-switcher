# Kiro MCP Switcher

A Kiro extension for **swapping the entire `mcpServers` configuration in `mcp.json`** and testing
each configuration in isolation — not just turning individual servers on and off.

Kiro's built-in MCP Servers view already lets you enable/disable servers. But a `disabled` server
still exists in the config, so Kiro is aware of it. When you want Kiro to behave **as if only one
specific configuration were present** — for example, to test a single MCP endpoint on its own, or
to compare how Kiro behaves under different full configurations — toggling isn't enough. This tool
keeps named **config presets**, each a complete `mcpServers` definition, and applying one replaces
the `mcpServers` block wholesale so Kiro sees exactly that preset and nothing else.

It also gives you an **Active Config** view to inspect what's actually in `mcp.json` right now
(with secrets masked), and snapshots `mcp.json` before each swap so you can roll back.

Built for [Kiro](https://kiro.dev), but works in any Code-OSS based editor since it just edits
Kiro's config file. Kiro re-reads `mcp.json` on window reload, so after applying a preset the
extension offers a one-click reload.

## When to use this

Good fit:

- **Testing one MCP endpoint in true isolation** — swap in a preset that defines only that server,
  so nothing else is present in the config while you test Kiro's behavior.
- **A/B testing full configurations** — keep several complete `mcpServers` setups as presets and
  switch between them, with snapshot/restore for safe experimentation.
- **Inspecting the live config** — see the actual servers and their parameters, with sensitive
  values hidden by default.

You probably don't need this if you only want to turn a couple of servers on/off (use Kiro's
built-in MCP Servers view) or give each project a fixed set of servers (use a per-workspace
`mcp.json`). This tool is aimed at the "swap the whole config to test it" workflow that those
approaches don't cover.

## What it does

- **Config Presets** — named presets stored as files under `<settings>/mcp-presets/`, each a full
  `mcpServers` definition. Applying one replaces the mcp.json `mcpServers` block wholesale (other
  top-level keys and comments preserved). Ideal for testing a single endpoint (or set) in isolation.
- **Active Config view** — expand each server in the current mcp.json to inspect its full entry
  (`command`, `args`, `url`, `headers`, `env`, `disabled`, …). Read-only.
- **Automatic snapshots** — mcp.json is snapshotted before each apply; restore with one command.
- **Workspace / User target**, selectable in settings.


## Target: workspace or user

The extension reads and writes exactly one file, chosen by the `kiroMcpSwitcher.target` setting:

| Setting value | File |
| --- | --- |
| `workspace` (default) | `<workspace>/.kiro/settings/mcp.json` |
| `user` | `~/.kiro/settings/mcp.json` |

Change it any time via **Settings**, the **gear icon** in the view title bar, or the
command **Kiro MCP: Select Target (Workspace / User)**. If no folder is open, use `user`.

## Settings

- `kiroMcpSwitcher.target` — `workspace` | `user` (default `workspace`).
- `kiroMcpSwitcher.reloadWindowOnApplyPreset` — reload the window automatically after applying a
  preset (default `false`; you're prompted otherwise).
- `kiroMcpSwitcher.maskSensitiveValues` — hide likely-secret values in the Active Config view
  (default `true`). Toggle live with the eye icon in the view title.


## Commands

All under the **Kiro MCP** category:

- Apply Config Preset
- Save Current as Preset
- New Empty Preset
- Duplicate Preset
- Delete Preset
- Open Preset File
- Restore Last Snapshot
- Toggle Sensitive Values (show/hide)
- Select Target (Workspace / User)
- Open mcp.json
- Refresh


## Config presets (full swap)

A **config preset** is a named, complete `mcpServers` definition stored as a file under
`<settings>/mcp-presets/`. Applying a preset replaces the mcp.json `mcpServers` block wholesale
(other top-level keys and comments are preserved), so Kiro sees exactly that preset's servers —
useful for testing a single endpoint (or a specific set) in isolation, which the enable/disable
toggle can't do (disabled servers still exist in the config).

- Create a preset by **Save Current as Preset**, **New Empty Preset** (opens for editing), or
  **Duplicate Preset**.
- **Apply** swaps the block. mcp.json is **snapshotted first**; use **Restore Last Snapshot**
  to roll back.
- After apply you're offered a one-click **Reload Window** so Kiro re-reads mcp.json; set
  `kiroMcpSwitcher.reloadWindowOnApplyPreset` to do it automatically for a fast test loop.
- Presets follow the current target (workspace or user). Keep preset files out of version
  control if they contain anything sensitive.

## Active Config view

Expand a server under **Active Config** to see its actual mcp.json entry as a tree — handy for
confirming what a preset applied. Values under sensitive keys (`Authorization`, `token`, `key`,
`secret`, `password`, …) are masked (`••••••`) by default; click the eye icon in the view title
to reveal them for the current session.

## Build

```bash
npm install
npm run package        # bundles to dist/extension.js
npm run vsix           # produces kiro-mcp-switcher-<version>.vsix
```

## Install in Kiro

1. `npm run vsix` to produce the `.vsix`.
2. In Kiro: Command Palette → **Extensions: Install from VSIX…** → pick the file.
   (Or `kiro --install-extension kiro-mcp-switcher-<version>.vsix`.)

To publish to Open VSX instead (so it installs from the Extensions view): set a real `publisher`
in `package.json`, create a namespace/token at <https://open-vsx.org>, then
`npx ovsx publish -p <token>`.

## Notes

- Edits are surgical (via `jsonc-parser`), so comments and formatting in `mcp.json` are preserved.
- Multi-root workspaces: the first workspace folder is used for the `workspace` target.
- Independent community tool — not affiliated with AWS or the Kiro team.
