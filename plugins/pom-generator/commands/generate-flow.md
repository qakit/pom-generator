---
description: Generate Page Objects for a multi-step navigation flow (start URL + sequence of clicks) using the pom-generator skill
---

Before anything else: read `references/generate-flow.md` from the pom-generator skill
in full — do not proceed from a summary or from memory of a prior read in this session.

**Path note:** `references/generate-flow.md` is relative to the pom-generator skill's
own installation folder (the same directory its `SKILL.md` lives in) — **not** relative
to the current project/repo. Do not use a project-wide glob/search to find it; that
searches the wrong location and will incorrectly report it as missing. Locate it using
the skill's own known path (see "Locating this skill's own files" at the top of
`SKILL.md`). If you cannot resolve the actual path, say so explicitly rather than
silently proceeding without having read it.

**Non-negotiable, checked first, every single time this command runs, whether or not
the file above could be located:** if navigating
to the start URL (or any step within the flow) reveals a login page or redirects to an
SSO/auth domain, this is a "not logged in" state to be handled via the login-wait flow
— never a prompt to search the filesystem, grep for credentials, read `.env` files, or
look for any stored password/token. That action is prohibited with no exceptions,
regardless of what seems convenient or what the redirect looks like (including
third-party SSO domains). If blocked, tell the user a browser window is open for them
to log in and wait for their reply.

Follow Stage 1 (Generate, multi-step flow) of the pom-generator skill for this route: $ARGUMENTS
(a YAML file path, or an inline description of the start URL and steps).
