// Pure, vscode-free helpers for rendering an mcp.json server entry as a tree,
// with masking of sensitive values. Unit-tested.

/** Keys whose values are likely secrets and should be masked by default. */
const SENSITIVE_PATTERNS = [
  'authorization',
  'token',
  'secret',
  'password',
  'passwd',
  'apikey',
  'api-key',
  'api_key',
  'accesskey',
  'access-key',
  'access_key',
  'clientsecret',
  'client-secret',
  'client_secret',
  'bearer',
  'credential',
  'private',
];

export function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase();
  return SENSITIVE_PATTERNS.some((p) => k.includes(p));
}

/** Fully mask a value; do not leak length or prefix. */
export function maskString(_value: string): string {
  return '••••••';
}

export function isLeaf(value: unknown): boolean {
  return !(value !== null && typeof value === 'object');
}

export interface ChildEntry {
  key: string;
  value: unknown;
}

/** Children of an object/array value as key/value entries (array indices become keys). */
export function childEntries(value: unknown): ChildEntry[] {
  if (Array.isArray(value)) {
    return value.map((v, i) => ({ key: String(i), value: v }));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(([key, v]) => ({ key, value: v }));
  }
  return [];
}

/**
 * Display string for a leaf value.
 * @param sensitive whether this leaf (by its own key or an ancestor key) is sensitive
 * @param mask whether masking is currently enabled
 */
export function leafDisplay(value: unknown, sensitive: boolean, mask: boolean): string {
  if (typeof value === 'string') {
    return sensitive && mask ? maskString(value) : value;
  }
  if (value === null) return 'null';
  return String(value);
}

/** Short type hint for a branch value (object/array), e.g. "{3}" or "[2]". */
export function branchHint(value: unknown): string {
  if (Array.isArray(value)) return `[${value.length}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value as object).length}}`;
  }
  return '';
}
