---
description: Pre-release pipeline — test, review, version, changelog, tag
argument-hint: [patch|minor|major] (optional, else derived from commits)
---

Prepare a release. Bump hint: $ARGUMENTS

1. Run the `test-runner` agent: full suite + lint + typecheck. Stop on red.
2. Run the `code-reviewer` agent on everything since the last tag. Stop on blockers.
3. Hand off to the `release-manager` agent: derive semver, update manifests, generate CHANGELOG.md section, create annotated tag, output the deploy checklist and exact release commands.
4. Log the release to `claude-toolkit/dashboard/data.js`.

Do not push tags or deploy — present the commands and checklist for me to execute.
