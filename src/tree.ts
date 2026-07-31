import * as vscode from 'vscode';
import { listServers, getTarget } from './mcpConfig';
import { getProfiles, activeProfileName } from './profiles';
import { listPresets, activePresetName } from './configPresets';

type Node =
  | { kind: 'category'; id: 'profiles' | 'servers' | 'presets'; label: string }
  | { kind: 'profile'; name: string; active: boolean }
  | { kind: 'server'; name: string; enabled: boolean }
  | { kind: 'preset'; name: string; active: boolean }
  | { kind: 'message'; label: string };

export class McpTreeProvider implements vscode.TreeDataProvider<Node> {
  private readonly _onDidChange = new vscode.EventEmitter<Node | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  refresh(): void {
    this._onDidChange.fire(undefined);
  }

  getTreeItem(node: Node): vscode.TreeItem {
    switch (node.kind) {
      case 'category': {
        const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.Expanded);
        item.contextValue = `category:${node.id}`;
        const icon =
          node.id === 'profiles' ? 'layers' : node.id === 'servers' ? 'server-process' : 'files';
        item.iconPath = new vscode.ThemeIcon(icon);
        if (node.id !== 'profiles') {
          item.description = getTarget();
        }
        return item;
      }
      case 'profile': {
        const item = new vscode.TreeItem(node.name, vscode.TreeItemCollapsibleState.None);
        item.contextValue = 'profile';
        item.iconPath = new vscode.ThemeIcon(node.active ? 'pass-filled' : 'circle-large-outline');
        if (node.active) {
          item.description = 'active';
        }
        item.command = {
          command: 'kiroMcpSwitcher.applyProfile',
          title: 'Apply',
          arguments: [node.name],
        };
        return item;
      }
      case 'server': {
        const item = new vscode.TreeItem(node.name, vscode.TreeItemCollapsibleState.None);
        item.contextValue = node.enabled ? 'server:enabled' : 'server:disabled';
        item.iconPath = new vscode.ThemeIcon(node.enabled ? 'check' : 'circle-slash');
        if (!node.enabled) {
          item.description = 'disabled';
        }
        item.command = {
          command: 'kiroMcpSwitcher.toggleServer',
          title: 'Toggle',
          arguments: [node.name],
        };
        return item;
      }
      case 'preset': {
        const item = new vscode.TreeItem(node.name, vscode.TreeItemCollapsibleState.None);
        item.contextValue = 'preset';
        item.iconPath = new vscode.ThemeIcon(node.active ? 'pass-filled' : 'file-code');
        if (node.active) {
          item.description = 'active';
        }
        item.command = {
          command: 'kiroMcpSwitcher.applyPreset',
          title: 'Apply',
          arguments: [node.name],
        };
        return item;
      }
      case 'message': {
        const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
        item.contextValue = 'message';
        return item;
      }
    }
  }

  async getChildren(node?: Node): Promise<Node[]> {
    if (!node) {
      return [
        { kind: 'category', id: 'presets', label: 'Config Presets' },
        { kind: 'category', id: 'profiles', label: 'Profiles' },
        { kind: 'category', id: 'servers', label: 'Servers' },
      ];
    }
    if (node.kind === 'category' && node.id === 'presets') {
      const names = await listPresets();
      if (names.length === 0) {
        return [{ kind: 'message', label: 'No presets yet — use "Save Current as Preset"' }];
      }
      const active = await activePresetName();
      return names.map((name) => ({ kind: 'preset', name, active: name === active }));
    }
    if (node.kind === 'category' && node.id === 'profiles') {
      const names = Object.keys(getProfiles());
      if (names.length === 0) {
        return [{ kind: 'message', label: 'No profiles yet — use "Save Current as Profile"' }];
      }
      const active = await activeProfileName();
      return names.map((name) => ({ kind: 'profile', name, active: name === active }));
    }
    if (node.kind === 'category' && node.id === 'servers') {
      const servers = await listServers();
      if (servers.length === 0) {
        return [{ kind: 'message', label: 'No servers found in mcp.json' }];
      }
      return servers.map((s) => ({ kind: 'server', name: s.name, enabled: s.enabled }));
    }
    return [];
  }
}
