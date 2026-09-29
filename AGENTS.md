# GGVault phase completion and review requirements

These are standing user instructions for all future GGVault phases.

Maintain `docs/project-progress.md` as the ongoing project tracker. Update phase status, completed work, outstanding tasks, validation evidence and the dated work log as work progresses. Before phase handover, update it with the final validation results and review delivery status. Distinguish implementation completion from commit/archive delivery; do not mark planned or unverified work complete.

Never package the complete development directory for review.

Before finishing each phase:

1. Verify Git excludes dependencies, build output, coverage, secrets, logs, caches and generated build artifacts. This includes node_modules, .next, dist, coverage and .env at every directory depth. Keep .env.example as the only environment file eligible for review packages.
2. Inspect the tracked file list as well as .gitignore: ignoring a previously tracked file does not remove it from Git. Never commit secrets or include them in a review archive.
3. Complete the phase's validation and commit the completed phase to Git. Ensure a baseline commit exists before starting phase implementation so the final phase commit has a parent and its diff represents the phase. Do not silently use a root commit as a phase-only diff.
4. Generate the following review files, replacing N with the phase number:

   ```sh
   git diff HEAD~1 HEAD > phaseN.patch
   git diff --stat HEAD~1 HEAD > phaseN-stat.txt
   git log -1 --stat > phaseN-commit.txt
   ```

   Preserve readable UTF-8 output on Windows. These generated files and the review ZIP are review deliverables, not application source to commit.

5. Create `GGvault-phaseN-review.zip` using an explicit source-file allowlist. Include changed application source, relevant tests, Prisma schema/migrations, documentation, relevant package.json files, package-lock.json, docker-compose.yml, .env.example, and all three phase review files. Use committed file contents corresponding to HEAD. Preserve repository-relative paths. Deleted files are represented by the patch; do not restore them into the archive.
6. Never include node_modules, .next, dist, coverage, .git, .env, other environment secrets, logs, caches, temporary files or generated build artifacts. Do not recursively zip the workspace.
7. Inspect the final archive member list for excluded files and verify that the patch, stat and commit metadata match the completed phase commit before handing it over. Report the commit ID and review archive path.

The repository initially has no commits. Establish the baseline before the next implementation phase so HEAD~1 is meaningful.
