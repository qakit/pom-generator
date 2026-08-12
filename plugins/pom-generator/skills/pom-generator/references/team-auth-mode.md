# Optional: team/CI auth mode (storage-state file)

**This is not the default.** By default this skill's Playwright MCP server runs with a
persistent browser profile: the user logs in once, manually, in the visible browser
window, and the login is remembered automatically for future runs — no session file,
no login script to maintain. This is the right default for one person working locally.

Use this alternative instead if:
- Multiple people on a team need to share one generation session/environment
- Generation needs to run in CI or a headless/no-display environment
- You want the session explicitly version-controllable or rotatable, rather than tied
  to one machine's local browser profile

## Setup

1. Write your own login script (outside anything this skill reads) that logs in and
   saves a Playwright storage state file, e.g.:
   ```ts
   import { chromium } from '@playwright/test';
   const browser = await chromium.launch({ headless: true });
   const page = await browser.newPage();
   await page.goto(LOGIN_URL);
   // ... fill credentials from env vars, submit ...
   await page.context().storageState({ path: 'auth/storageState.json' });
   ```
2. Add `auth/storageState.json` and any credentials file to `.gitignore` and
   `.claudeignore` — this skill must never read them directly.
3. Override the bundled MCP server config in your **project's own** `.mcp.json`
   (this takes precedence over the plugin's default for this project):
   ```json
   {
     "mcpServers": {
       "playwright": {
         "command": "npx",
         "args": [
           "@playwright/mcp@latest",
           "--isolated",
           "--storage-state=${CLAUDE_PROJECT_DIR}/auth/storageState.json",
           "--viewport-size=1440,900"
         ]
       }
     }
   }
   ```
4. Re-run your login script whenever the session expires (CI: on a schedule; local
   team use: whenever generation reports being logged out).

With this override in place, the Stage 0 preflight in `generate-single.md` /
`generate-flow.md` should check for the file's existence instead of checking login
state via snapshot — mention this to the user if they've set up this mode, since the
default preflight logic assumes the persistent-profile path.
