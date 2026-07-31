// Stub the 'vscode' module and load the bundled extension to verify activate() runs
// without throwing and registers its commands. Run after `npm run package`.
const path = require('path');
const Module = require('module');
const registered = [];

function disposable() {
  return { dispose() {} };
}

const vscodeStub = {
  StatusBarAlignment: { Left: 1, Right: 2 },
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
  ThemeIcon: class {
    constructor(id) {
      this.id = id;
    }
  },
  TreeItem: class {
    constructor(label, state) {
      this.label = label;
      this.collapsibleState = state;
    }
  },
  EventEmitter: class {
    constructor() {
      this.event = () => disposable();
    }
    fire() {}
    dispose() {}
  },
  Uri: { file: (p) => ({ fsPath: p, scheme: 'file', path: p }) },
  RelativePattern: class {
    constructor(base, pat) {
      this.base = base;
      this.pattern = pat;
    }
  },
  window: {
    registerTreeDataProvider: (id) => {
      registered.push('view:' + id);
      return disposable();
    },
    createStatusBarItem: () => ({
      command: '',
      text: '',
      tooltip: '',
      show() {},
      hide() {},
      dispose() {},
    }),
    setStatusBarMessage: () => disposable(),
    showQuickPick: async () => undefined,
    showInputBox: async () => undefined,
    showInformationMessage: () => {},
    showWarningMessage: async () => undefined,
    showErrorMessage: (m) => {
      console.log('ERROR MSG:', m);
    },
    showTextDocument: async () => {},
  },
  commands: {
    registerCommand: (id) => {
      registered.push('cmd:' + id);
      return disposable();
    },
    executeCommand: async () => {},
  },
  workspace: {
    workspaceFolders: undefined,
    getConfiguration: () => ({ get: (k, d) => d, update: async () => {} }),
    onDidChangeConfiguration: () => disposable(),
    createFileSystemWatcher: () => ({
      onDidChange() {},
      onDidCreate() {},
      onDidDelete() {},
      dispose() {},
    }),
    openTextDocument: async () => ({}),
  },
};

const orig = Module._load;
Module._load = function (request, ...args) {
  if (request === 'vscode') return vscodeStub;
  return orig.call(this, request, ...args);
};

const store = new Map();
const context = {
  subscriptions: [],
  globalState: { get: (k, d) => (store.has(k) ? store.get(k) : d), update: async (k, v) => store.set(k, v) },
  workspaceState: { get: (k, d) => d, update: async () => {} },
  secrets: { get: async () => undefined, store: async () => {}, delete: async () => {} },
};

const bundlePath = path.resolve(__dirname, '..', 'dist', 'extension.js');
const ext = require(bundlePath);
try {
  ext.activate(context);
  console.log('activate() returned without throwing');
} catch (e) {
  console.log('activate() THREW:', (e && e.stack) || e);
  process.exitCode = 1;
}
setTimeout(() => {
  const cmds = registered.filter((r) => r.startsWith('cmd:'));
  console.log('registered commands:', cmds.length);
  const need = [
    'cmd:kiroMcpSwitcher.applyPreset',
    'cmd:kiroMcpSwitcher.savePresetFromCurrent',
    'cmd:kiroMcpSwitcher.restoreSnapshot',
    'cmd:kiroMcpSwitcher.toggleMask',
  ];
  const missing = need.filter((n) => !registered.includes(n));
  console.log('has all key commands:', missing.length === 0, missing.length ? missing : '');
  if (missing.length) process.exitCode = 1;
}, 100);
