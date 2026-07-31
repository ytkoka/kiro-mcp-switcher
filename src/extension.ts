import * as path from 'path';
import * as vscode from 'vscode';
import {
  getTarget,
  Target,
  resolveMcpPath,
  listServers,
  setServersEnabled,
  ensureMcpFile,
} from './mcpConfig';
import {
  getProfiles,
  saveCurrentAsProfile,
  deleteProfile,
  applyProfile,
  activeProfileName,
} from './profiles';
import { McpTreeProvider } from './tree';
import {
  listPresets,
  applyPreset,
  savePresetFromCurrent,
  createEmptyPreset,
  duplicatePreset,
  deletePreset,
  restoreLastSnapshot,
  hasSnapshot,
  presetFilePath,
} from './configPresets';

let statusBar: vscode.StatusBarItem;
let watcher: vscode.FileSystemWatcher | undefined;
let tree: McpTreeProvider;

export function activate(context: vscode.ExtensionContext): void {
  tree = new McpTreeProvider();
  context.subscriptions.push(vscode.window.registerTreeDataProvider('kiroMcpSwitcher.view', tree));

  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.command = 'kiroMcpSwitcher.switchProfile';
  context.subscriptions.push(statusBar);

  const refresh = async (): Promise<void> => {
    tree.refresh();
    await updateStatusBar();
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('kiroMcpSwitcher.refresh', refresh),
    vscode.commands.registerCommand('kiroMcpSwitcher.switchProfile', () => switchProfile(refresh)),
    vscode.commands.registerCommand('kiroMcpSwitcher.applyProfile', async (arg?: unknown) => {
      const name = resolveName(arg);
      if (!name) {
        return switchProfile(refresh);
      }
      await guard(async () => {
        await applyProfile(name);
        await refresh();
        vscode.window.setStatusBarMessage(`MCP profile "${name}" applied`, 2000);
      });
    }),
    vscode.commands.registerCommand('kiroMcpSwitcher.toggleServer', async (arg?: unknown) => {
      const name = resolveName(arg);
      if (!name) {
        return toggleServersQuickPick(refresh);
      }
      await guard(async () => {
        const s = (await listServers()).find((x) => x.name === name);
        if (!s) {
          return;
        }
        await setServersEnabled([{ name, enabled: !s.enabled }]);
        await refresh();
      });
    }),
    vscode.commands.registerCommand('kiroMcpSwitcher.toggleServers', () =>
      toggleServersQuickPick(refresh),
    ),
    vscode.commands.registerCommand('kiroMcpSwitcher.saveProfile', () => saveProfile(refresh)),
    vscode.commands.registerCommand('kiroMcpSwitcher.deleteProfile', async (arg?: unknown) => {
      const target = resolveName(arg) ?? (await pickProfile('Select a profile to delete'));
      if (!target) {
        return;
      }
      await deleteProfile(target);
      await refresh();
    }),
    vscode.commands.registerCommand('kiroMcpSwitcher.selectTarget', () => selectTarget(refresh)),
    vscode.commands.registerCommand('kiroMcpSwitcher.openConfig', openConfig),
    vscode.commands.registerCommand('kiroMcpSwitcher.applyPreset', (arg?: unknown) =>
      applyPresetCmd(refresh, resolveName(arg)),
    ),
    vscode.commands.registerCommand('kiroMcpSwitcher.savePresetFromCurrent', () =>
      savePresetCmd(refresh),
    ),
    vscode.commands.registerCommand('kiroMcpSwitcher.newEmptyPreset', () => newPresetCmd(refresh)),
    vscode.commands.registerCommand('kiroMcpSwitcher.duplicatePreset', (arg?: unknown) =>
      duplicatePresetCmd(refresh, resolveName(arg)),
    ),
    vscode.commands.registerCommand('kiroMcpSwitcher.deletePreset', (arg?: unknown) =>
      deletePresetCmd(refresh, resolveName(arg)),
    ),
    vscode.commands.registerCommand('kiroMcpSwitcher.openPreset', (arg?: unknown) =>
      openPresetCmd(resolveName(arg)),
    ),
    vscode.commands.registerCommand('kiroMcpSwitcher.restoreSnapshot', () =>
      restoreSnapshotCmd(refresh),
    ),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('kiroMcpSwitcher')) {
        setupWatcher(context);
        void refresh();
      }
    }),
  );

  setupWatcher(context);
  void refresh();
}

/**
 * Tree menu commands (inline/context buttons) receive the tree element object,
 * while the status bar, palette, and item.command pass a plain name string.
 * Normalize both to the name string.
 */
function resolveName(arg: unknown): string | undefined {
  if (typeof arg === 'string') {
    return arg;
  }
  if (arg && typeof arg === 'object') {
    const o = arg as { name?: unknown; label?: unknown };
    if (typeof o.name === 'string') {
      return o.name;
    }
    if (typeof o.label === 'string') {
      return o.label;
    }
  }
  return undefined;
}

async function guard(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    vscode.window.showErrorMessage(`Kiro MCP Switcher: ${(err as Error).message}`);
  }
}

function setupWatcher(context: vscode.ExtensionContext): void {
  watcher?.dispose();
  watcher = undefined;
  const p = resolveMcpPath();
  if (!p) {
    return;
  }
  const pattern = new vscode.RelativePattern(vscode.Uri.file(path.dirname(p)), 'mcp.json');
  watcher = vscode.workspace.createFileSystemWatcher(pattern);
  const onChange = (): void => {
    tree.refresh();
    void updateStatusBar();
  };
  watcher.onDidChange(onChange);
  watcher.onDidCreate(onChange);
  watcher.onDidDelete(onChange);
  context.subscriptions.push(watcher);
}

async function updateStatusBar(): Promise<void> {
  const target = getTarget();
  let label = 'custom';
  try {
    const active = await activeProfileName();
    if (active) {
      label = active;
    }
  } catch {
    // ignore — status bar is best-effort
  }
  statusBar.text = `$(server) MCP: ${label} (${target})`;
  statusBar.tooltip = `Kiro MCP Switcher\nTarget: ${target}\nClick to switch profile`;
  statusBar.show();
}

async function switchProfile(refresh: () => Promise<void>): Promise<void> {
  const name = await pickProfile('Switch MCP profile');
  if (!name) {
    return;
  }
  await guard(async () => {
    await applyProfile(name);
    await refresh();
    vscode.window.setStatusBarMessage(`MCP profile "${name}" applied`, 2000);
  });
}

async function pickProfile(placeHolder: string): Promise<string | undefined> {
  const profiles = getProfiles();
  const names = Object.keys(profiles);
  if (names.length === 0) {
    vscode.window.showInformationMessage(
      'No profiles defined yet. Use "Kiro MCP: Save Current as Profile".',
    );
    return undefined;
  }
  const active = await activeProfileName();
  const items = names.map((n) => ({
    label: n === active ? `$(pass-filled) ${n}` : n,
    description: (profiles[n] ?? []).join(', ') || '(no servers enabled)',
    name: n,
  }));
  const pick = await vscode.window.showQuickPick(items, { placeHolder });
  return pick?.name;
}

async function toggleServersQuickPick(refresh: () => Promise<void>): Promise<void> {
  const servers = await listServers();
  if (servers.length === 0) {
    vscode.window.showInformationMessage('No MCP servers found in mcp.json.');
    return;
  }
  const items = servers.map((s) => ({ label: s.name, picked: s.enabled, name: s.name }));
  const picks = await vscode.window.showQuickPick(items, {
    canPickMany: true,
    placeHolder: 'Check the servers that should be enabled',
  });
  if (!picks) {
    return; // cancelled
  }
  const enabledSet = new Set(picks.map((p) => p.name));
  const updates = servers.map((s) => ({ name: s.name, enabled: enabledSet.has(s.name) }));
  await guard(async () => {
    await setServersEnabled(updates);
    await refresh();
  });
}

async function saveProfile(refresh: () => Promise<void>): Promise<void> {
  const name = await vscode.window.showInputBox({
    prompt: 'Name for this profile (captures the currently enabled servers)',
    validateInput: (v) => (v.trim() ? undefined : 'Please enter a name'),
  });
  if (!name) {
    return;
  }
  await saveCurrentAsProfile(name.trim());
  await refresh();
  vscode.window.setStatusBarMessage(`Saved profile "${name.trim()}"`, 2000);
}

async function selectTarget(refresh: () => Promise<void>): Promise<void> {
  const current = getTarget();
  const pick = await vscode.window.showQuickPick(
    [
      {
        label: 'Workspace',
        description: '.kiro/settings/mcp.json',
        value: 'workspace' as Target,
        picked: current === 'workspace',
      },
      {
        label: 'User',
        description: '~/.kiro/settings/mcp.json',
        value: 'user' as Target,
        picked: current === 'user',
      },
    ],
    { placeHolder: 'Which mcp.json should the switcher act on?' },
  );
  if (!pick) {
    return;
  }
  const scope = vscode.workspace.workspaceFolders?.length
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;
  await vscode.workspace.getConfiguration('kiroMcpSwitcher').update('target', pick.value, scope);
  await refresh();
}

async function openConfig(): Promise<void> {
  const p = await ensureMcpFile();
  if (!p) {
    vscode.window.showErrorMessage(
      'No workspace folder is open. Switch target to "user", or open a folder.',
    );
    return;
  }
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(p));
  await vscode.window.showTextDocument(doc);
}

export function deactivate(): void {
  watcher?.dispose();
}

// ---------- config preset commands ----------

async function pickPreset(placeHolder: string): Promise<string | undefined> {
  const names = await listPresets();
  if (names.length === 0) {
    vscode.window.showInformationMessage('No presets yet. Use "Save Current as Preset" first.');
    return undefined;
  }
  const pick = await vscode.window.showQuickPick(names, { placeHolder });
  return pick;
}

async function offerReload(): Promise<void> {
  const auto = vscode.workspace
    .getConfiguration('kiroMcpSwitcher')
    .get<boolean>('reloadWindowOnApplyPreset', false);
  if (auto) {
    await vscode.commands.executeCommand('workbench.action.reloadWindow');
    return;
  }
  const choice = await vscode.window.showInformationMessage(
    'Preset applied to mcp.json. Reload the window so Kiro re-reads it (or reload the server in Kiro\'s MCP panel).',
    'Reload Window',
  );
  if (choice === 'Reload Window') {
    await vscode.commands.executeCommand('workbench.action.reloadWindow');
  }
}

async function applyPresetCmd(refresh: () => Promise<void>, preset?: string): Promise<void> {
  const name = preset ?? (await pickPreset('Apply which config preset?'));
  if (!name) {
    return;
  }
  await guard(async () => {
    await applyPreset(name);
    await refresh();
    await offerReload();
  });
}

async function savePresetCmd(refresh: () => Promise<void>): Promise<void> {
  const name = await vscode.window.showInputBox({
    prompt: 'Name for this preset (captures the current mcp.json servers)',
    validateInput: (v) => (v.trim() ? undefined : 'Please enter a name'),
  });
  if (!name) {
    return;
  }
  await guard(async () => {
    await savePresetFromCurrent(name.trim());
    await refresh();
    vscode.window.setStatusBarMessage(`Saved preset "${name.trim()}"`, 2500);
  });
}

async function newPresetCmd(refresh: () => Promise<void>): Promise<void> {
  const name = await vscode.window.showInputBox({
    prompt: 'Name for the new empty preset (opens for editing)',
    validateInput: (v) => (v.trim() ? undefined : 'Please enter a name'),
  });
  if (!name) {
    return;
  }
  await guard(async () => {
    const p = await createEmptyPreset(name.trim());
    await refresh();
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(p));
    await vscode.window.showTextDocument(doc);
  });
}

async function duplicatePresetCmd(refresh: () => Promise<void>, preset?: string): Promise<void> {
  const src = preset ?? (await pickPreset('Duplicate which preset?'));
  if (!src) {
    return;
  }
  const dst = await vscode.window.showInputBox({
    prompt: `Name for the copy of "${src}"`,
    value: `${src}-copy`,
    validateInput: (v) => (v.trim() ? undefined : 'Please enter a name'),
  });
  if (!dst) {
    return;
  }
  await guard(async () => {
    await duplicatePreset(src, dst.trim());
    await refresh();
  });
}

async function deletePresetCmd(refresh: () => Promise<void>, preset?: string): Promise<void> {
  const name = preset ?? (await pickPreset('Delete which preset?'));
  if (!name) {
    return;
  }
  const confirm = await vscode.window.showWarningMessage(
    `Delete preset "${name}"? This removes the preset file.`,
    { modal: true },
    'Delete',
  );
  if (confirm !== 'Delete') {
    return;
  }
  await guard(async () => {
    await deletePreset(name);
    await refresh();
  });
}

async function openPresetCmd(preset?: string): Promise<void> {
  const name = preset ?? (await pickPreset('Open which preset?'));
  if (!name) {
    return;
  }
  const p = presetFilePath(name);
  if (!p) {
    vscode.window.showErrorMessage('No workspace folder is open.');
    return;
  }
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(p));
  await vscode.window.showTextDocument(doc);
}

async function restoreSnapshotCmd(refresh: () => Promise<void>): Promise<void> {
  if (!(await hasSnapshot())) {
    vscode.window.showInformationMessage('No snapshot to restore yet. Snapshots are taken when you apply a preset.');
    return;
  }
  const confirm = await vscode.window.showWarningMessage(
    'Restore mcp.json to the most recent snapshot (taken before the last preset apply)?',
    { modal: true },
    'Restore',
  );
  if (confirm !== 'Restore') {
    return;
  }
  await guard(async () => {
    const ok = await restoreLastSnapshot();
    await refresh();
    if (ok) {
      await offerReload();
    }
  });
}
