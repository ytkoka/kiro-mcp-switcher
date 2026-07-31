# Kiro MCP Switcher

Toggle individual MCP servers, or switch between named **profiles** (sets of enabled servers),
without hand-editing `mcp.json`. Built for [Kiro](https://kiro.dev), but works in any Code‑OSS
based editor (Kiro, Cursor, Windsurf, VSCodium, …) since it just edits Kiro's config file.

Kiro watches `mcp.json` and reconciles running servers on save, so changes apply live — no restart.

## What it does

- **Sidebar view** ("MCP Switcher" in the activity bar) listing your Profiles and Servers.
- **One‑click toggle** of any server (writes `disabled: true/false`).
- **Profiles**: save the current on/off combination under a name, then switch to it later.
- **Status bar item** showing the active profile and target, click to switch.
- **Workspace vs. User target**, selectable in settings (see below).

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
- `kiroMcpSwitcher.stateField` — `disabled` | `enabled` (default `disabled`). Kiro's documented
  field is `disabled`; only switch this if your config uses an `enabled` key instead.
- `kiroMcpSwitcher.profiles` — map of profile name → list of server names to enable. Editable by
  hand or via "Save Current as Profile". Example:

  ```json
  "kiroMcpSwitcher.profiles": {
    "frontend": ["fetch", "playwright"],
    "aws": ["aws-docs", "aws-knowledge"]
  }
  ```

A profile enables exactly the servers it lists and disables every other server present in
`mcp.json`. Server *definitions* stay in `mcp.json`; profiles only flip the on/off flags.

## Commands

All under the **Kiro MCP** category:

- Switch Profile
- Save Current as Profile
- Delete Profile
- Toggle Servers (multi-select)
- Select Target (Workspace / User)
- Open mcp.json
- Refresh

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
