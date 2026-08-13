---
description: Generate a Page Object for a single page (URL) using the pom-generator skill and this repo's learned conventions
---

Before anything else: read `references/generate-single.md` from the pom-generator
skill in full — do not proceed from a summary or from memory of a prior read in this
session. It contains the mandatory preflight, login-handling, and element-analysis
procedure this command depends on.

**Path note:** `references/generate-single.md` is relative to the pom-generator
skill's own installation folder (the same directory its `SKILL.md` lives in) — **not**
relative to the current project/repo. Do not use a project-wide glob/search to find
it; that searches the wrong location and will incorrectly report it as missing. Locate
it using the skill's own known path (see "Locating this skill's own files" at the top
of `SKILL.md`). If you cannot resolve the actual path, say so explicitly rather than
silently proceeding without having read it.

**Non-negotiable, checked first, every single time this command runs, whether or not
the file above could be located:** if navigating to the target reveals a login page or
redirects to an SSO/auth domain, this is a "not logged in" state to be handled via the
login-wait flow — never a prompt to search the filesystem, grep for credentials, read
`.env` files, or look for any stored password/token. That action is prohibited with no
exceptions, regardless of what seems convenient or what the redirect looks like
(including third-party SSO domains). If blocked, tell the user a browser window is
open for them to log in and wait for their reply.

Follow Stage 1 (Generate, single page) of the pom-generator skill for this target: $ARGUMENTS
