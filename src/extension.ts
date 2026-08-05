import * as path from 'path';
import * as vscode from 'vscode';
import { getTarget, Target, resolveMcpPath, ensureMcpFile, setServerDisabledFlag } from './mcpConfig';
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
  activePresetName,
  presetServerCount,
  currentServerCount,
  isValidPresetName,
} from './configPresets';

let statusBar: vscode.StatusBarItem;
let watcher: vscode.FileSystemWatcher | undefined;
let tree: McpTreeProvider;

export function activate(context: vscode.ExtensionContext): void {
  tree = new McpTreeProvider();
  context.subscriptions.push(vscode.window.registerTreeDataProvider('kiroMcpSwitcher.view', tree));

  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.command = 'kiroMcpSwitcher.applyPreset';
  context.subscriptions.push(statusBar);

  const refresh = async (): Promise<void> => {
    tree.refresh();
    await updateStatusBar();
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('kiroMcpSwitcher.refresh', refresh),
    vscode.commands.registerCommand('kiroMcpSwitcher.selectTarget', () => selectTarget(refresh)),
    vscode.commands.registerCommand('kiroMcpSwitcher.openConfig', openConfig),
    vscode.commands.registerCommand('kiroMcpSwitcher.toggleMask', () => toggleMask(refresh)),
    vscode.commands.registerCommand('kiroMcpSwitcher.toggleDisabled', (arg?: unknown) =>
      toggleDisabledCmd(refresh, arg),
    ),
    vscode.commands.registerCommand('kiroMcpSwitcher.applyPreset', (arg?: unknown) =>
      applyPresetCmd(refresh, resolveName(arg)),
    ),
    vscode.commands.registerCommand('kiroMcpSwitcher.savePresetFromCurrent', () =>
      savePresetCmd(refresh),
    ),
    vscode.commands.registerCommand('kiroMcpSwitcher.newEmptyPreset', () => newPresetCmd(refresh)),
    vscode.commands.registerCommand('kiroMcpSwitcher.updatePresetFromCurrent', (arg?: unknown) =>
      updateFromCurrentCmd(refresh, resolveName(arg)),
    ),
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

  void cleanupLegacyProfiles();
  setupWatcher(context);
  void refresh();
}

/** Tree menu commands pass the element object; status bar/palette pass a name string. */
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
    const active = await activePresetName();
    if (active) {
      label = active;
    }
  } catch {
    // best-effort
  }
  statusBar.text = `$(server) MCP: ${label} (${target})`;
  statusBar.tooltip = `Kiro MCP Switcher\nTarget: ${target}\nClick to apply a config preset`;
  statusBar.show();
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

async function toggleMask(refresh: () => Promise<void>): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('kiroMcpSwitcher');
  const current = cfg.get<boolean>('maskSensitiveValues', true);
  await cfg.update('maskSensitiveValues', !current, vscode.ConfigurationTarget.Global);
  await refresh();
  vscode.window.setStatusBarMessage(
    !current ? 'Sensitive values hidden' : 'Sensitive values shown',
    2000,
  );
}

/** Toggle a server's `disabled` flag from the Active Config tree (inline on the `disabled` row). */
async function toggleDisabledCmd(refresh: () => Promise<void>, arg: unknown): Promise<void> {
  if (!arg || typeof arg !== 'object') {
    return;
  }
  const o = arg as { server?: unknown; value?: unknown };
  if (typeof o.server !== 'string' || typeof o.value !== 'boolean') {
    return;
  }
  const next = !o.value;
  await guard(async () => {
    await setServerDisabledFlag(o.server as string, next);
    await refresh();
    // light, non-blocking notification with an optional reload action
    const choice = await vscode.window.showInformationMessage(
      `${o.server}: disabled = ${next}. Reload the window for Kiro to pick it up.`,
      'Reload Window',
    );
    if (choice === 'Reload Window') {
      await vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
  });
}

// ---------- config preset commands ----------

async function pickPreset(placeHolder: string): Promise<string | undefined> {
  const names = await listPresets();
  if (names.length === 0) {
    vscode.window.showInformationMessage('No presets yet. Use "Save Current as Preset" first.');
    return undefined;
  }
  return vscode.window.showQuickPick(names, { placeHolder });
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
    "Preset applied to mcp.json. Reload the window so Kiro re-reads it (or reload the server in Kiro's MCP panel).",
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
  if ((await presetServerCount(name)) === 0) {
    const confirm = await vscode.window.showWarningMessage(
      `Preset "${name}" is empty. Applying it will remove all servers from the current mcp.json. Continue?`,
      { modal: true },
      'Apply Empty Preset',
    );
    if (confirm !== 'Apply Empty Preset') {
      return;
    }
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
    validateInput: (v) =>
      isValidPresetName(v) ? undefined : 'Enter a name with at least one letter or number',
  });
  if (!name) {
    return;
  }
  if ((await currentServerCount()) === 0) {
    const confirm = await vscode.window.showWarningMessage(
      `The current mcp.json has no servers, so "${name.trim()}" would be saved as an empty preset. Applying an empty preset later clears mcp.json. Save it anyway?`,
      { modal: true },
      'Save Empty Preset',
    );
    if (confirm !== 'Save Empty Preset') {
      return;
    }
  }
  await guard(async () => {
    await savePresetFromCurrent(name.trim());
    await refresh();
    vscode.window.setStatusBarMessage(`Saved preset "${name.trim()}"`, 2500);
  });
}

async function newPresetCmd(refresh: () => Promise<void>): Promise<void> {
  const name = await vscode.window.showInputBox({
    prompt: 'Name for the new preset',
    validateInput: (v) =>
      isValidPresetName(v) ? undefined : 'Enter a name with at least one letter or number',
  });
  if (!name) {
    return;
  }
  const confirm = await vscode.window.showWarningMessage(
    `Create empty preset "${name.trim()}" and clear the current mcp.json so you can build a fresh config? The current config is snapshotted and can be restored.`,
    { modal: true },
    'Create & Clear',
  );
  if (confirm !== 'Create & Clear') {
    return;
  }
  await guard(async () => {
    await createEmptyPreset(name.trim());
    // applying the empty preset snapshots the current mcp.json, then blanks it
    await applyPreset(name.trim());
    await refresh();
    // open the real mcp.json (not the preset file) so editing/adding servers is intuitive
    const p = await ensureMcpFile();
    if (p) {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(p));
      await vscode.window.showTextDocument(doc);
    }
    vscode.window.setStatusBarMessage(
      `Cleared mcp.json. Build your config, then run "Update Preset from Current mcp.json" on "${name.trim()}".`,
      6000,
    );
  });
}

async function updateFromCurrentCmd(refresh: () => Promise<void>, preset?: string): Promise<void> {
  const name = preset ?? (await pickPreset('Update which preset from the current mcp.json?'));
  if (!name) {
    return;
  }
  if ((await currentServerCount()) === 0) {
    const confirm = await vscode.window.showWarningMessage(
      `The current mcp.json has no servers, so "${name}" would become an empty preset. Update anyway?`,
      { modal: true },
      'Update to Empty',
    );
    if (confirm !== 'Update to Empty') {
      return;
    }
  }
  await guard(async () => {
    await savePresetFromCurrent(name);
    await refresh();
    vscode.window.setStatusBarMessage(`Updated preset "${name}" from the current mcp.json`, 2500);
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
    validateInput: (v) =>
      isValidPresetName(v) ? undefined : 'Enter a name with at least one letter or number',
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
    vscode.window.showInformationMessage(
      'No snapshot to restore yet. Snapshots are taken when you apply a preset.',
    );
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

/** Remove the obsolete `kiroMcpSwitcher.profiles` setting left by pre-0.2.1 versions. */
async function cleanupLegacyProfiles(): Promise<void> {
  try {
    const cfg = vscode.workspace.getConfiguration('kiroMcpSwitcher');
    const info = cfg.inspect('profiles');
    if (info?.globalValue !== undefined) {
      await cfg.update('profiles', undefined, vscode.ConfigurationTarget.Global);
    }
    if (info?.workspaceValue !== undefined) {
      await cfg.update('profiles', undefined, vscode.ConfigurationTarget.Workspace);
    }
  } catch {
    // ignore — cleanup is best-effort
  }
}

export function deactivate(): void {
  watcher?.dispose();
}
