import * as fs from 'fs/promises';
import * as fssync from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import * as jsonc from 'jsonc-parser';

export type Target = 'workspace' | 'user';

function cfg() {
  return vscode.workspace.getConfiguration('kiroMcpSwitcher');
}

export function getTarget(): Target {
  return cfg().get<Target>('target', 'workspace');
}

/**
 * Absolute path to the mcp.json for the given target, or undefined when
 * "workspace" is selected but no folder is open.
 */
export function resolveMcpPath(target: Target = getTarget()): string | undefined {
  if (target === 'user') {
    return path.join(os.homedir(), '.kiro', 'settings', 'mcp.json');
  }
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return undefined;
  }
  return path.join(folder.uri.fsPath, '.kiro', 'settings', 'mcp.json');
}

/** Create an empty mcp.json (and parent dirs) if it does not exist. */
export async function ensureMcpFile(target: Target = getTarget()): Promise<string | undefined> {
  const p = resolveMcpPath(target);
  if (!p) return undefined;
  if (!fssync.existsSync(p)) {
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, JSON.stringify({ mcpServers: {} }, null, 2) + '\n', 'utf8');
  }
  return p;
}

/** Read the raw mcpServers object from the target mcp.json (for the Active Config view). */
export async function readMcpServers(
  target: Target = getTarget(),
): Promise<Record<string, unknown>> {
  const p = resolveMcpPath(target);
  if (!p) return {};
  try {
    const text = await fs.readFile(p, 'utf8');
    const root = jsonc.parse(text, [], { allowTrailingComma: true }) ?? {};
    const s = (root as Record<string, unknown>).mcpServers;
    return s && typeof s === 'object' ? (s as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
