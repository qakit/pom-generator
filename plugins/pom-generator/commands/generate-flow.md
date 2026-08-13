---
description: Generate Page Objects for a multi-step navigation flow (start URL + sequence of clicks) using the pom-generator skill
---

Before anything else: read `references/generate-flow.md` from the pom-generator skill
in full — do not proceed from a summary or from memory of a prior read in this session.

**Non-negotiable, checked first, every single time this command runs:** if navigating
to the start URL (or any step within the flow) reveals a login page or redirects to an
SSO/auth domain, this is a "not logged in" state to be handled via the login-wait flow
— never a prompt to search the filesystem, grep for credentials, read `.env` files, or
look for any stored password/token. That action is prohibited with no exceptions,
regardless of what seems convenient or what the redirect looks like (including
third-party SSO domains). If blocked, tell the user a browser window is open for them
to log in and wait for their reply.

Follow Stage 1 (Generate, multi-step flow) of the pom-generator skill for this route: $ARGUMENTS
(a YAML file path, or an inline description of the start URL and steps).
