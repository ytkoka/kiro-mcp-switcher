# Publishing to Open VSX

This walks through publishing so the extension is installable from the Extensions view in
Kiro (and other Code-OSS editors), while you can still hand a `.vsix` to customers directly.

## 0. Publisher / namespace name

This project is already set to publish under **`ytkoka`**, so the extension identity is
`ytkoka.kiro-mcp-switcher`. The `repository`, `bugs`, and `homepage` fields point at
`https://github.com/ytkoka/kiro-mcp-switcher`.

Note: Open VSX has no self-service delete, and the publisher ID cannot be changed later — it
is baked into the extension identity. If you ever want a different name you must publish under
a new namespace and deprecate the old one.

## 1. One-time account setup (the part people trip on)

Open VSX logs you in with **GitHub**, but requires the **Eclipse Foundation Publisher
Agreement** for legal reasons. This is NOT the Eclipse Contributor Agreement (ECA).

1. Create an Eclipse account at <https://accounts.eclipse.org/user/register> and put your
   **GitHub username** in the account profile.
2. Log in to <https://open-vsx.org> with GitHub.
3. Profile → **Log in with Eclipse** to link the accounts.
4. On your Open VSX profile, click **Show Publisher Agreement**, read to the bottom, **Agree**.

Without this, publishing fails with "You must log in with an Eclipse Foundation account and
sign a Publisher Agreement…".

## 2. Create an access token (once; reusable)

open-vsx.org → avatar → **Settings → Access Tokens → Generate New Token**. Copy it now — it
is shown only once. Store it in a password manager. Never commit it.

## 3. Create your namespace (once per publisher name)

```bash
npx ovsx create-namespace ytkoka -p <token>
```

The namespace must equal the `publisher` field in package.json (`ytkoka`).

## 4. Build and publish

```bash
npm install
npm run package                 # bundles dist/extension.js
npx ovsx publish -p <token>     # packages via vsce and uploads
```

Or publish a prebuilt file:

```bash
npm run vsix                    # produces kiro-mcp-switcher-<version>.vsix
npx ovsx publish kiro-mcp-switcher-<version>.vsix -p <token>
```

Tip: instead of `-p <token>`, you can set the env var `OVSX_PAT` (handy for CI). A GitHub
Action is available at `HaaLeo/publish-vscode-extension` if you want to automate releases.

## 5. (Optional) Get the "verified" badge

Creating a namespace does NOT mark you as verified owner. To show the verified badge, claim
ownership of the namespace from your Open VSX settings. Unverified extensions still publish
and install fine — they just carry an "unverified" note.

## 6. Publishing updates

You cannot overwrite a version. For each release:

1. Bump `version` in package.json (and add a CHANGELOG entry).
2. Re-run step 4 with the same token.

## How customers install it

- **From the Extensions view** (Kiro, Cursor, Windsurf, VSCodium, …): search
  "Kiro MCP Switcher" and click Install. (Note: Microsoft's own VS Code points at the MS
  Marketplace by default, not Open VSX.)
- **Direct file**: send them the `.vsix` and have them run
  "Extensions: Install from VSIX…", or `kiro --install-extension <file>.vsix`.

## Security reminders

- The token grants publish rights to your namespace — treat it like a password; revoke and
  regenerate if leaked.
- Publishing runs a secret-detection scan; don't embed API keys or tokens in the code.
- Published artifacts are effectively permanent (removal is not self-service), so review the
  metadata and contents before your first publish.
