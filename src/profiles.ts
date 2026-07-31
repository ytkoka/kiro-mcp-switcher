import * as vscode from 'vscode';
import { listServers, setServersEnabled } from './mcpConfig';

/** profileName -> list of server names that should be enabled. */
export type Profiles = Record<string, string[]>;

export function getProfiles(): Profiles {
  return vscode.workspace.getConfiguration('kiroMcpSwitcher').get<Profiles>('profiles', {});
}

async function saveProfiles(profiles: Profiles): Promise<void> {
  const scope = vscode.workspace.workspaceFolders?.length
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;
  await vscode.workspace.getConfiguration('kiroMcpSwitcher').update('profiles', profiles, scope);
}

/** Capture the currently-enabled servers as a named profile. */
export async function saveCurrentAsProfile(name: string): Promise<void> {
  const servers = await listServers();
  const enabled = servers.filter((s) => s.enabled).map((s) => s.name);
  await saveProfiles({ ...getProfiles(), [name]: enabled });
}

export async function deleteProfile(name: string): Promise<void> {
  const profiles = { ...getProfiles() };
  delete profiles[name];
  await saveProfiles(profiles);
}

/** Enable exactly the servers listed in the profile; disable everything else. */
export async function applyProfile(name: string): Promise<void> {
  const enabledSet = new Set(getProfiles()[name] ?? []);
  const servers = await listServers();
  const updates = servers.map((s) => ({ name: s.name, enabled: enabledSet.has(s.name) }));
  await setServersEnabled(updates);
}

/** Name of the profile whose enabled-set exactly matches the current state, if any. */
export async function activeProfileName(): Promise<string | undefined> {
  const servers = await listServers();
  const current = new Set(servers.filter((s) => s.enabled).map((s) => s.name));
  for (const [name, list] of Object.entries(getProfiles())) {
    const set = new Set(list);
    if (set.size === current.size && [...set].every((n) => current.has(n))) {
      return name;
    }
  }
  return undefined;
}
