#!/usr/bin/env bash
# Tags HEAD with the next semantic version and publishes a GitHub Release for it.
# Used by .github/workflows/release.yml on every push to `main`.
#
#   BUMP     major | minor | patch. Empty: `patch` when HEAD merges a `hotfix/*` branch, `minor` otherwise.
#   DRY_RUN  1 prints the tag it would create and stops before tagging.
#
# With no version tag yet, the first one is v0.1.0. A HEAD that already has a version tag is left alone.
set -euo pipefail

version_pattern='^v[0-9]+\.[0-9]+\.[0-9]+$'
sha=$(git rev-parse HEAD)

existing=$(git tag --points-at "$sha" | grep -E "$version_pattern" || true)
if [ -n "$existing" ]; then
  echo "HEAD ($sha) is already tagged as $existing; nothing to do."
  exit 0
fi

bump="${BUMP:-}"
if [ -z "$bump" ]; then
  subject=$(git log -1 --format=%s "$sha")
  if [[ "$subject" =~ ^Merge\ pull\ request\ \#[0-9]+\ from\ [^/]+/hotfix/ ]]; then
    bump=patch
  else
    bump=minor
  fi
fi

latest=$(git tag --list 'v*' --sort=-v:refname | grep -E "$version_pattern" | head -n 1 || true)
if [ -z "$latest" ]; then
  next=v0.1.0
else
  IFS=. read -r major minor patch <<<"${latest#v}"
  case "$bump" in
    major) next="v$((major + 1)).0.0" ;;
    minor) next="v${major}.$((minor + 1)).0" ;;
    patch) next="v${major}.${minor}.$((patch + 1))" ;;
    *) echo "Unknown bump '$bump' (expected major, minor or patch)." >&2; exit 1 ;;
  esac
fi

echo "Previous version: ${latest:-none}. Bump: $bump. New version: $next ($sha)."
if [ "${DRY_RUN:-}" = "1" ]; then
  exit 0
fi

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git tag -a "$next" "$sha" -m "Release $next"
git push origin "refs/tags/$next"
gh release create "$next" --verify-tag --generate-notes --title "$next"
