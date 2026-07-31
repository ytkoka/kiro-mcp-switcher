import * as fs from 'fs/promises';
import * as fssync from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import * as jsonc from 'jsonc-parser';

export type Target = 'workspace' | 'user';
export type StateField = 'disabled' | 'enabled';

export interface ServerInfo {
  name: string;
  enabled: boolean;
}

function cfg() {
  return vscode.workspace.getConfiguration('kiroMcpSwitcher');
}

export function getTarget(): Target {
  return cfg().get<Target>('target', 'workspace');
}

export function getStateField(): StateField {
  return cfg().get<StateField>('stateField', 'disabled');
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

async function readText(p: string): Promise<string | undefined> {
  try {
    return await fs.readFile(p, 'utf8');
  } catch {
    return undefined;
  }
}

function parseServers(text: string): Record<string, unknown> {
  const root = jsonc.parse(text, [], { allowTrailingComma: true }) ?? {};
  const servers = (root as Record<string, unknown>).mcpServers;
  return servers && typeof servers === 'object' ? (servers as Record<string, unknown>) : {};
}

function computeEnabled(entry: unknown, field: StateField): boolean {
  if (!entry || typeof entry !== 'object') {
    return true;
  }
  const e = entry as { enabled?: unknown; disabled?: unknown };
  if (field === 'enabled') {
    if (typeof e.enabled === 'boolean') return e.enabled;
    if (typeof e.disabled === 'boolean') return !e.disabled;
    return true;
  }
  if (typeof e.disabled === 'boolean') return !e.disabled;
  if (typeof e.enabled === 'boolean') return e.enabled;
  return true;
}

export async function listServers(target: Target = getTarget()): Promise<ServerInfo[]> {
  const p = resolveMcpPath(target);
  if (!p) return [];
  const text = await readText(p);
  if (text === undefined) return [];
  const servers = parseServers(text);
  const field = getStateField();
  return Object.keys(servers).map((name) => ({
    name,
    enabled: computeEnabled(servers[name], field),
  }));
}

export function mcpExists(target: Target = getTarget()): boolean {
  const p = resolveMcpPath(target);
  return !!p && fssync.existsSync(p);
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

/**
 * Flip the on/off state of one or more servers, preserving the rest of the
 * file (including comments and formatting) via jsonc surgical edits.
 * Kiro's file watcher picks up the change on write — no restart needed.
 */
export async function setServersEnabled(
  updates: { name: string; enabled: boolean }[],
  target: Target = getTarget(),
): Promise<void> {
  const p = resolveMcpPath(target);
  if (!p) {
    throw new Error(
      'No workspace folder is open. Open a folder, or set "kiroMcpSwitcher.target" to "user".',
    );
  }
  let text = await readText(p);
  if (text === undefined) {
    text = JSON.stringify({ mcpServers: {} }, null, 2) + '\n';
  }
  const field = getStateField();
  const opts: jsonc.ModificationOptions = {
    formattingOptions: { insertSpaces: true, tabSize: 2 },
  };
  for (const u of updates) {
    // `disabled` is inverted relative to enabled; `enabled` maps directly.
    const value = field === 'enabled' ? u.enabled : !u.enabled;
    const edits = jsonc.modify(text, ['mcpServers', u.name, field], value, opts);
    text = jsonc.applyEdits(text, edits);
  }
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, text, 'utf8');
}
