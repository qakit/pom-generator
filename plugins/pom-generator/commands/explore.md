---
description: Bootstrap or refresh .pom-generator/conventions.md and component-registry.md from the current framework code
---

**Non-negotiable, every time:** if any navigation during this exploration reveals a
login page or redirects to an SSO/auth domain, this is a "not logged in" state — never
a prompt to search the filesystem, grep for credentials, or read `.env`/config/secrets
files. Tell the user and wait for them to log in manually.

Follow Stage 0 (Explore) of the pom-generator skill exactly, in its three checkpointed
sub-stages, pausing for confirmation after each one. Target directories: $ARGUMENTS
(if empty, ask the user where their Page Object code lives, or infer from
src/pages, src/elements, src/components if present).
