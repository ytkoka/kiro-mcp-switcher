# Kiro MCP Switcher

Switch between named **Config Presets** (complete `mcpServers` definitions) and inspect the
**Active Config** currently in effect, without hand-editing `mcp.json`. Built for
[Kiro](https://kiro.dev), but works in any Code‑OSS based editor (Kiro, Cursor, Windsurf,
VSCodium, …) since it just edits Kiro's config file.

Kiro watches `mcp.json` and reconciles running servers on save, so changes apply live — no restart.

## What it does

- **Sidebar view** ("MCP Switcher" in the activity bar) listing your Config Presets and the
  Active Config.
- **Config Presets**: named, complete `mcpServers` definitions you can swap in wholesale — see
  below.
- **Active Config view**: expand any server in the current `mcp.json` to inspect its full entry
  (`command`, `args`, `url`, `headers`, `env`, `disabled`, …), read-only.
- **Sensitive value masking**: likely-secret values (tokens, keys, passwords, …) are hidden by
  default; toggle with the eye icon.
- **Status bar item** showing the active preset and target, click to apply a preset.
- **Workspace vs. User target**, selectable in settings (see below).

## Config presets (full swap)

Each preset is a complete `mcpServers` object stored as its own file under
`<settings>/mcp-presets/<name>.json` (next to the target `mcp.json`, so it follows the
`workspace`/`user` target setting).

Applying a preset replaces the **entire `mcpServers` block** in `mcp.json` with the preset's
servers — nothing else survives the swap. Every other top-level key and every comment in
`mcp.json` outside of `mcpServers` is left untouched. This makes it easy to get Kiro to see
*only* one endpoint (or one specific set) for isolated behavior testing.

- **Create**: capture the current `mcp.json` as a preset ("Save Current as Preset"), start from
  an empty preset and edit it by hand ("New Empty Preset"), or copy an existing one ("Duplicate
  Preset").
- **Snapshots**: applying a preset automatically snapshots the current `mcp.json` first (kept
  under `<settings>/mcp-snapshots/`, last 10 retained). Use "Restore Last Snapshot" to undo the
  most recent apply.
- **Reload**: Kiro has no public command to force an MCP reload after an external file write, so
  after applying a preset the extension offers a one-click **Reload Window**. Set
  `kiroMcpSwitcher.reloadWindowOnApplyPreset` to `true` to reload automatically instead of being
  prompted, or just use Kiro's own MCP panel reload if you'd rather not reload the whole window.

Preset files can contain anything a normal `mcpServers` entry can, including tokens or other
secrets for the servers they describe. If any of your presets hold sensitive values, keep
`mcp-presets/` (and `mcp-snapshots/`) out of version control, the same way you'd treat `mcp.json`
itself.

## Active Config view (expand & mask)

The "Active Config" section of the sidebar mirrors exactly what's in the target `mcp.json` right
now — one entry per server, expandable into its full definition (`command`, `args`, `url`,
`headers`, `env`, `disabled`, and anything else present). It's read-only: use it to verify what's
actually live, not to edit.

Keys that look like they hold secrets (`Authorization`, `token`, `apiKey`, `clientSecret`,
`password`, …, matched case-insensitively, anywhere nested under a server) are masked as `••••••`
by default, so the tree is safe to leave open or screenshot. Toggle visibility with the eye icon
in the view title, or set `kiroMcpSwitcher.maskSensitiveValues` to `false` to always show them.

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
- `kiroMcpSwitcher.reloadWindowOnApplyPreset` — boolean (default `false`). Automatically reload
  the window after applying a preset instead of being prompted.
- `kiroMcpSwitcher.maskSensitiveValues` — boolean (default `true`). Hide likely-secret values in
  the Active Config view.

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
- Upgrading from a pre-0.2.1 version: the old Profiles feature and its
  `kiroMcpSwitcher.profiles` setting are removed automatically on first activation.
