import * as jsonc from 'jsonc-parser';

const FMT: jsonc.ModificationOptions = {
  formattingOptions: { insertSpaces: true, tabSize: 2 },
};

/** Parse a JSON/JSONC document and return its top-level object (tolerant of comments). */
export function parseRoot(text: string): Record<string, unknown> {
  const root = jsonc.parse(text, [], { allowTrailingComma: true });
  return root && typeof root === 'object' ? (root as Record<string, unknown>) : {};
}

/** Extract the `mcpServers` object from a document. */
export function extractMcpServers(text: string): Record<string, unknown> {
  const s = parseRoot(text).mcpServers;
  return s && typeof s === 'object' ? (s as Record<string, unknown>) : {};
}

/** Number of servers defined in a servers object (0 = empty). */
export function serverCount(servers: Record<string, unknown>): number {
  return Object.keys(servers ?? {}).length;
}

/**
 * Set `mcpServers.<server>.disabled` to a boolean, preserving the rest of the
 * file (comments/formatting) via a surgical jsonc edit.
 */
export function setServerDisabled(text: string, server: string, disabled: boolean): string {
  const edits = jsonc.modify(text, ['mcpServers', server, 'disabled'], disabled, FMT);
  return jsonc.applyEdits(text, edits);
}

/**
 * Replace ONLY the `mcpServers` block with the given object, preserving other
 * top-level keys and any comments outside the mcpServers block. This is the
 * "full swap" used by config presets: after this, Kiro sees exactly the servers
 * in `servers` and nothing else.
 */
export function replaceMcpServers(text: string, servers: Record<string, unknown>): string {
  const edits = jsonc.modify(text, ['mcpServers'], servers, FMT);
  return jsonc.applyEdits(text, edits);
}

/** Build a fresh preset document body wrapping a servers object. */
export function presetDocument(servers: Record<string, unknown>): string {
  return JSON.stringify({ mcpServers: servers }, null, 2) + '\n';
}

/** Order-independent deep equality for comparing server blocks (to detect the active preset). */
export function serversEqual(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b);
}

/** Deep-clone a servers object with every server's top-level `disabled` key removed. */
function stripDisabled(servers: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (servers && typeof servers === 'object' && !Array.isArray(servers)) {
    for (const [name, entry] of Object.entries(servers as Record<string, unknown>)) {
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        const { disabled: _omit, ...rest } = entry as Record<string, unknown>;
        out[name] = rest;
      } else {
        out[name] = entry;
      }
    }
  }
  return out;
}

/**
 * Compare two server blocks ignoring each server's `disabled` flag. Used so that
 * toggling `disabled` during testing doesn't make a preset look "not applied".
 */
export function serversEqualIgnoringDisabled(a: unknown, b: unknown): boolean {
  return canonical(stripDisabled(a)) === canonical(stripDisabled(b));
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return '[' + value.map(canonical).join(',') + ']';
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonical(obj[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

/** Restrict preset names to safe filename characters. */
export function sanitize(name: string): string {
  return name.trim().replace(/[^\w.-]+/g, '-');
}

/**
 * A preset name is valid only if, after sanitizing, it contains at least one
 * alphanumeric character. Rejects empty and symbol-only names like "-" that
 * would otherwise create confusing files such as "-.json".
 */
export function isValidPresetName(name: string): boolean {
  return /[A-Za-z0-9]/.test(sanitize(name));
}
