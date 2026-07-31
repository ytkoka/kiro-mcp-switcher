// Loads dist/extension.js against a minimal `vscode` mock, calls activate(),
// and reports which commands got registered. Catches the class of bug where
// a broken bundled dependency throws during activate() and silently leaves
// zero commands registered (UI still renders from package.json contributions,
// so the failure only surfaces as "command not found" at click time).
'use strict';

const Module = require('module');
const path = require('path');

const registeredCommands = new Set();

class FakeEventEmitter {
  constructor() {
    this.event = () => ({ dispose() {} });
  }
  fire() {}
  dispose() {}
}

const vscodeMock = {
  StatusBarAlignment: { Left: 1, Right: 2 },
  ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  EventEmitter: FakeEventEmitter,
  ThemeIcon: class {
    constructor(id) {
      this.id = id;
    }
  },
  TreeItem: class {
    constructor(label, collapsibleState) {
      this.label = label;
      this.collapsibleState = collapsibleState;
    }
  },
  Uri: { file: (p) => ({ fsPath: p, path: p }) },
  RelativePattern: class {
    constructor(base, pattern) {
      this.base = base;
      this.pattern = pattern;
    }
  },
  window: {
    createStatusBarItem: () => ({
      show() {},
      hide() {},
      dispose() {},
    }),
    registerTreeDataProvider: () => ({ dispose() {} }),
    showErrorMessage: () => {},
    showInformationMessage: () => {},
    showQuickPick: async () => undefined,
    showInputBox: async () => undefined,
    showTextDocument: async () => {},
    setStatusBarMessage: () => {},
  },
  workspace: {
    onDidChangeConfiguration: () => ({ dispose() {} }),
    createFileSystemWatcher: () => ({
      onDidChange: () => ({ dispose() {} }),
      onDidCreate: () => ({ dispose() {} }),
      onDidDelete: () => ({ dispose() {} }),
      dispose() {},
    }),
    getConfiguration: () => ({
      get: () => undefined,
      update: async () => {},
    }),
    workspaceFolders: undefined,
    openTextDocument: async () => ({}),
  },
  commands: {
    registerCommand: (id) => {
      registeredCommands.add(id);
      return { dispose() {} };
    },
  },
};

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === 'vscode') {
    return 'vscode';
  }
  return originalResolve.call(this, request, ...rest);
};

const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'vscode') {
    return vscodeMock;
  }
  return originalLoad.call(this, request, ...rest);
};

const extensionPath = path.join(__dirname, '..', 'dist', 'extension.js');
const extension = require(extensionPath);

const context = { subscriptions: [] };
extension.activate(context);

const hasSwitchProfile = registeredCommands.has('kiroMcpSwitcher.switchProfile');

console.log('registered commands:', [...registeredCommands].sort());
console.log('has switchProfile:', hasSwitchProfile);

if (!hasSwitchProfile) {
  console.error('SMOKE TEST FAILED: kiroMcpSwitcher.switchProfile was not registered');
  process.exit(1);
}

console.log('SMOKE TEST PASSED');
