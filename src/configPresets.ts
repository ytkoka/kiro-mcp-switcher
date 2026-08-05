import * as fs from 'fs/promises';
import * as fssync from 'fs';
import * as path from 'path';
import { resolveMcpPath, getTarget, Target } from './mcpConfig';
import {
  extractMcpServers,
  replaceMcpServers,
  presetDocument,
  serversEqual,
  serversEqualIgnoringDisabled,
  serverCount,
  sanitize,
} from './mcpEdit';

export { isValidPresetName } from './mcpEdit';

/** Directory holding preset files, next to the target mcp.json. */
export function presetsDir(target: Target = getTarget()): string | undefined {
  const p = resolveMcpPath(target);
  if (!p) return undefined;
  return path.join(path.dirname(p), 'mcp-presets');
}

function snapshotsDir(target: Target = getTarget()): string | undefined {
  const p = resolveMcpPath(target);
  if (!p) return undefined;
  return path.join(path.dirname(p), 'mcp-snapshots');
}

function presetPath(name: string, target: Target = getTarget()): string | undefined {
  const d = presetsDir(target);
  return d ? path.join(d, `${sanitize(name)}.json`) : undefined;
}

async function readText(p: string): Promise<string | undefined> {
  try {
    return await fs.readFile(p, 'utf8');
  } catch {
    return undefined;
  }
}

export async function listPresets(target: Target = getTarget()): Promise<string[]> {
  const d = presetsDir(target);
  if (!d) return [];
  try {
    const entries = await fs.readdir(d);
    return entries
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -'.json'.length))
      .sort();
  } catch {
    return [];
  }
}

/**
 * The active preset is the one whose servers match the current mcp.json.
 * Matching ignores each server's `disabled` flag, so toggling disabled during
 * testing keeps the preset shown as active. `modified` is true when the match
 * only holds once `disabled` is ignored (i.e. the live config differs only by
 * disabled flags).
 */
export async function activePresetInfo(
  target: Target = getTarget(),
): Promise<{ name?: string; modified: boolean }> {
  const p = resolveMcpPath(target);
  if (!p) return { modified: false };
  const cur = await readText(p);
  if (cur === undefined) return { modified: false };
  const curServers = extractMcpServers(cur);
  let relaxed: string | undefined;
  for (const name of await listPresets(target)) {
    const pp = presetPath(name, target);
    if (!pp) continue;
    const txt = await readText(pp);
    if (txt === undefined) continue;
    const ps = extractMcpServers(txt);
    if (serversEqual(ps, curServers)) {
      return { name, modified: false };
    }
    if (relaxed === undefined && serversEqualIgnoringDisabled(ps, curServers)) {
      relaxed = name;
    }
  }
  return relaxed ? { name: relaxed, modified: true } : { modified: false };
}

/** Name of the preset matching the current mcp.json (ignoring disabled flags), if any. */
export async function activePresetName(target: Target = getTarget()): Promise<string | undefined> {
  return (await activePresetInfo(target)).name;
}

async function ensureDir(d: string): Promise<void> {
  await fs.mkdir(d, { recursive: true });
}

/** Save the current mcp.json's mcpServers block as a preset. */
export async function savePresetFromCurrent(
  name: string,
  target: Target = getTarget(),
): Promise<void> {
  const p = resolveMcpPath(target);
  const pp = presetPath(name, target);
  if (!p || !pp) {
    throw new Error('No workspace folder is open. Switch target to "user" or open a folder.');
  }
  const cur = (await readText(p)) ?? '{"mcpServers":{}}';
  await ensureDir(path.dirname(pp));
  await fs.writeFile(pp, presetDocument(extractMcpServers(cur)), 'utf8');
}

export async function createEmptyPreset(
  name: string,
  target: Target = getTarget(),
): Promise<string> {
  const pp = presetPath(name, target);
  if (!pp) {
    throw new Error('No workspace folder is open. Switch target to "user" or open a folder.');
  }
  await ensureDir(path.dirname(pp));
  if (!fssync.existsSync(pp)) {
    await fs.writeFile(pp, presetDocument({}), 'utf8');
  }
  return pp;
}

export async function duplicatePreset(
  src: string,
  dst: string,
  target: Target = getTarget(),
): Promise<void> {
  const sp = presetPath(src, target);
  const dp = presetPath(dst, target);
  if (!sp || !dp) {
    throw new Error('No workspace folder is open.');
  }
  const txt = (await readText(sp)) ?? presetDocument({});
  await ensureDir(path.dirname(dp));
  await fs.writeFile(dp, txt, 'utf8');
}

export async function deletePreset(name: string, target: Target = getTarget()): Promise<void> {
  const pp = presetPath(name, target);
  if (pp) {
    await fs.rm(pp, { force: true });
  }
}

export function presetFilePath(name: string, target: Target = getTarget()): string | undefined {
  return presetPath(name, target);
}

/** Number of servers defined in a preset file (0 = empty / missing). */
export async function presetServerCount(
  name: string,
  target: Target = getTarget(),
): Promise<number> {
  const pp = presetPath(name, target);
  if (!pp) return 0;
  const txt = await readText(pp);
  if (txt === undefined) return 0;
  return serverCount(extractMcpServers(txt));
}

/** Number of servers currently defined in the target mcp.json. */
export async function currentServerCount(target: Target = getTarget()): Promise<number> {
  const p = resolveMcpPath(target);
  if (!p) return 0;
  const txt = await readText(p);
  if (txt === undefined) return 0;
  return serverCount(extractMcpServers(txt));
}

/** Take a timestamped snapshot of the current mcp.json (best-effort, keeps the last 10). */
async function snapshot(target: Target): Promise<void> {
  const p = resolveMcpPath(target);
  const d = snapshotsDir(target);
  if (!p || !d) return;
  const cur = await readText(p);
  if (cur === undefined) return;
  await ensureDir(d);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  await fs.writeFile(path.join(d, `${stamp}.json`), cur, 'utf8');
  // prune to the newest 10
  try {
    const files = (await fs.readdir(d)).filter((f) => f.endsWith('.json')).sort();
    for (const old of files.slice(0, Math.max(0, files.length - 10))) {
      await fs.rm(path.join(d, old), { force: true });
    }
  } catch {
    /* ignore */
  }
}

export async function hasSnapshot(target: Target = getTarget()): Promise<boolean> {
  const d = snapshotsDir(target);
  if (!d) return false;
  try {
    return (await fs.readdir(d)).some((f) => f.endsWith('.json'));
  } catch {
    return false;
  }
}

/**
 * Apply a preset: snapshot the current mcp.json, then replace its mcpServers block
 * with the preset's (other top-level keys and comments are preserved).
 */
export async function applyPreset(name: string, target: Target = getTarget()): Promise<void> {
  const p = resolveMcpPath(target);
  const pp = presetPath(name, target);
  if (!p || !pp) {
    throw new Error('No workspace folder is open. Switch target to "user" or open a folder.');
  }
  const presetText = await readText(pp);
  if (presetText === undefined) {
    throw new Error(`Preset "${name}" not found.`);
  }
  await snapshot(target);
  const servers = extractMcpServers(presetText);
  let cur = await readText(p);
  if (cur === undefined) {
    cur = '{\n  "mcpServers": {}\n}\n';
  }
  const next = replaceMcpServers(cur, servers);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, next, 'utf8');
}

/** Restore the most recent snapshot back into mcp.json. */
export async function restoreLastSnapshot(target: Target = getTarget()): Promise<boolean> {
  const p = resolveMcpPath(target);
  const d = snapshotsDir(target);
  if (!p || !d) return false;
  let files: string[];
  try {
    files = (await fs.readdir(d)).filter((f) => f.endsWith('.json')).sort();
  } catch {
    return false;
  }
  const last = files[files.length - 1];
  if (!last) return false;
  const txt = await readText(path.join(d, last));
  if (txt === undefined) return false;
  await fs.writeFile(p, txt, 'utf8');
  return true;
}
