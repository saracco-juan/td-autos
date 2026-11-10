# TD Autos — contributing

Branch and commit conventions, and what continuous integration checks on every change. How to run each part locally is in [`getting-started.md`](getting-started.md).

## Branches

- One branch per user story (UH), created from `develop`: `feature/uh-<number>-<short-description>`.
  - Example: `feature/uh-12-registro-usuario`.
- Urgent fixes on `main`: `hotfix/<short-description>`.
- Every branch reaches `develop` through a pull request.

## Commits

Commits follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<scope>): <description>

[optional body]

[optional footer]
```

| Type | When to use it |
|------|----------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting or styles, no logic change |
| `refactor` | Code change that neither adds a feature nor fixes a bug |
| `test` | Add or fix tests |
| `chore` | Maintenance: dependencies, configuration, tooling |
| `build` | Build system or external dependencies |
| `ci` | Continuous integration |
| `perf` | Performance improvement |
| `revert` | Reverts an earlier commit |

| Scope | Part of the project |
|-------|---------------------|
| `api` | Backend |
| `db` | Migrations and data model |
| `web` | Web frontend |
| `mobile` | Mobile app |

Rules:

- Description in the imperative, lowercase first letter, no final period, up to 72 characters.
- One commit = one coherent change, with its tests.
- Reference the UH in the footer: `Refs: UH-12`.
- Breaking changes: `!` after the type (`feat(api)!: ...`) and a `BREAKING CHANGE: <detail>` footer.

Examples:

```text
feat(web): add registration form
fix(api): reject duplicated email on register
test(api): cover password reset flow
docs: add project README
```

## Continuous integration

The [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) workflow runs on every push and pull request to `develop` and `main`:

| Job | What it checks |
|-----|----------------|
| Backend | `./vendor/bin/pint --test` and `php artisan test` with coverage |
| Web frontend | `npm run lint`, `npm run test:coverage` and `npm run build` |
| Mobile app | `npm run lint`, `npm run typecheck`, `npm run test:coverage` and `npx expo export --platform android` |
| Duplication (PRs only) | `node scripts/check-duplication.mjs` against the base branch: fails before Sonar if new code is more than 3% duplicated |
| SonarQube Cloud | Static analysis and coverage of the three projects, configured in [`sonar-project.properties`](../sonar-project.properties) |

The SonarQube Cloud job needs the `SONAR_TOKEN` secret in the GitHub repository and does not run on pull requests opened from forks.

Merging to `main` requires the Backend, Web frontend and both SonarQube checks to pass (repository ruleset).

## Releases

Every push to `main` is a promotion to production, and the [`.github/workflows/release.yml`](../.github/workflows/release.yml) workflow tags it (`scripts/release-tag.sh`) and publishes a GitHub Release whose notes list the pull requests merged since the previous tag.

| Merged into `main` | New version |
|--------------------|-------------|
| `develop` (or any other branch) | minor: `v0.1.0` → `v0.2.0` |
| `hotfix/<short-description>` | patch: `v0.2.0` → `v0.2.1` |

- For another bump (for example `major` for the final delivery), run it by hand: Actions → Release → Run workflow, branch `main`, choose the bump. A commit that already has a version tag is skipped.
- The hotfix rule reads the merge commit subject (`Merge pull request #N from <owner>/hotfix/...`), so merge hotfixes with a merge commit, not squash or rebase.
- To see what is in production, compare tags (`git log v0.1.0..v0.2.0`); to roll back, redeploy the commit of the previous tag in Render and Vercel.
