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
    vscode.commands.registerCommand('kiroMcpSwitcher.applyProfile', async (name?: string) => {
      if (!name) {
        return switchProfile(refresh);
      }
      await guard(async () => {
        await applyProfile(name);
        await refresh();
        vscode.window.setStatusBarMessage(`MCP profile "${name}" applied`, 2000);
      });
    }),
    vscode.commands.registerCommand('kiroMcpSwitcher.toggleServer', async (name?: string) => {
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
    vscode.commands.registerCommand('kiroMcpSwitcher.deleteProfile', async (name?: string) => {
      const target = name ?? (await pickProfile('Select a profile to delete'));
      if (!target) {
        return;
      }
      await deleteProfile(target);
      await refresh();
    }),
    vscode.commands.registerCommand('kiroMcpSwitcher.selectTarget', () => selectTarget(refresh)),
    vscode.commands.registerCommand('kiroMcpSwitcher.openConfig', openConfig),
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
