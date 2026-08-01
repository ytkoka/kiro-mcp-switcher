import * as vscode from 'vscode';
import { getTarget, readMcpServers } from './mcpConfig';
import { listPresets, activePresetName, presetServerCount } from './configPresets';
import {
  childEntries,
  isLeaf,
  isSensitiveKey,
  leafDisplay,
  branchHint,
} from './configView';

type Node =
  | { kind: 'category'; id: 'presets' | 'active'; label: string }
  | { kind: 'preset'; name: string; active: boolean; empty: boolean }
  | { kind: 'configserver'; name: string; value: unknown }
  | { kind: 'param'; key: string; value: unknown; sensitive: boolean }
  | { kind: 'message'; label: string };

function maskEnabled(): boolean {
  return vscode.workspace
    .getConfiguration('kiroMcpSwitcher')
    .get<boolean>('maskSensitiveValues', true);
}

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
        item.iconPath = new vscode.ThemeIcon(node.id === 'presets' ? 'files' : 'server-process');
        item.description = getTarget();
        return item;
      }
      case 'preset': {
        const item = new vscode.TreeItem(node.name, vscode.TreeItemCollapsibleState.None);
        item.contextValue = 'preset';
        item.iconPath = new vscode.ThemeIcon(
          node.active ? 'pass-filled' : node.empty ? 'warning' : 'file-code',
        );
        const tags = [node.active ? 'active' : '', node.empty ? 'empty' : ''].filter(Boolean);
        if (tags.length) {
          item.description = tags.join(' · ');
        }
        if (node.empty) {
          item.tooltip = 'This preset has no servers. Applying it will clear mcp.json.';
        }
        item.command = {
          command: 'kiroMcpSwitcher.applyPreset',
          title: 'Apply',
          arguments: [node.name],
        };
        return item;
      }
      case 'configserver': {
        const item = new vscode.TreeItem(node.name, vscode.TreeItemCollapsibleState.Collapsed);
        item.contextValue = 'configserver';
        item.iconPath = new vscode.ThemeIcon('server');
        return item;
      }
      case 'param': {
        const leaf = isLeaf(node.value);
        const item = new vscode.TreeItem(
          node.key,
          leaf ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed,
        );
        item.contextValue = 'param';
        if (leaf) {
          item.description = leafDisplay(node.value, node.sensitive, maskEnabled());
          if (node.sensitive && maskEnabled()) {
            item.iconPath = new vscode.ThemeIcon('lock');
            item.tooltip = 'Sensitive value hidden. Toggle "Show sensitive values" to reveal.';
          }
        } else {
          item.description = branchHint(node.value);
        }
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
        { kind: 'category', id: 'active', label: 'Active Config' },
      ];
    }
    if (node.kind === 'category' && node.id === 'presets') {
      const names = await listPresets();
      if (names.length === 0) {
        return [{ kind: 'message', label: 'No presets yet — use "Save Current as Preset"' }];
      }
      const active = await activePresetName();
      return Promise.all(
        names.map(async (name) => ({
          kind: 'preset' as const,
          name,
          active: name === active,
          empty: (await presetServerCount(name)) === 0,
        })),
      );
    }
    if (node.kind === 'category' && node.id === 'active') {
      const servers = await readMcpServers();
      const names = Object.keys(servers);
      if (names.length === 0) {
        return [{ kind: 'message', label: 'No servers in the current mcp.json' }];
      }
      return names.map((name) => ({ kind: 'configserver', name, value: servers[name] }));
    }
    if (node.kind === 'configserver') {
      return childEntries(node.value).map((c) => ({
        kind: 'param',
        key: c.key,
        value: c.value,
        sensitive: isSensitiveKey(c.key),
      }));
    }
    if (node.kind === 'param' && !isLeaf(node.value)) {
      return childEntries(node.value).map((c) => ({
        kind: 'param',
        key: c.key,
        value: c.value,
        // sensitivity propagates into nested subtrees
        sensitive: node.sensitive || isSensitiveKey(c.key),
      }));
    }
    return [];
  }
}
