#!/usr/bin/env node
// Duplication check on new code, close to the SonarQube Cloud quality gate ("Duplicated lines on new code" <= 3%).
// Runs jscpd over the Sonar sources, keeps the clones that touch lines changed against the base branch and fails
// when the duplicated share of those lines is over the limit. Usage, from the repository root:
//   node scripts/check-duplication.mjs [--base origin/develop] [--max 3]
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const JSCPD = 'jscpd@4.3.0'
// Same roots as sonar.sources in sonar-project.properties; tests are excluded there as well.
const SOURCES = [
  'backend/app',
  'backend/routes',
  'backend/config',
  'backend/database',
  'frontend/web/src',
  'frontend/mobile/src',
  'frontend/shared',
]
const IGNORE = ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**', '**/node_modules/**']
const CODE = /\.(php|ts|tsx|js|jsx|mjs|css)$/
const TEST = /(\.test\.tsx?$)|(\/__tests__\/)/

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : process.argv[index + 1]
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

// Lines added or changed against the merge base, uncommitted work included: { file: Set<line> }.
function changedLines(base) {
  const mergeBase = git('merge-base', base, 'HEAD').trim()
  const changed = new Map()
  let file = null
  for (const line of git('diff', '-U0', '--no-color', mergeBase, '--', ...SOURCES).split('\n')) {
    if (line.startsWith('+++ ')) {
      const path = line.slice(4)
      file = path === '/dev/null' ? null : path.replace(/^b\//, '')
      if (file && (!CODE.test(file) || TEST.test(file))) file = null
      continue
    }
    const hunk = line.match(/^@@ -\S+ \+(\d+)(?:,(\d+))? @@/)
    if (hunk && file) {
      const start = Number(hunk[1])
      const count = hunk[2] === undefined ? 1 : Number(hunk[2])
      if (!changed.has(file)) changed.set(file, new Set())
      for (let n = start; n < start + count; n += 1) changed.get(file).add(n)
    }
  }
  // Files not added to git yet are new code too, every line of them.
  for (const path of git('ls-files', '--others', '--exclude-standard', '--', ...SOURCES).split('\n')) {
    if (!path || !CODE.test(path) || TEST.test(path)) continue
    const count = readFileSync(path, 'utf8').split('\n').length
    changed.set(path, new Set(Array.from({ length: count }, (_, i) => i + 1)))
  }
  return changed
}

function clones() {
  const output = mkdtempSync(join(tmpdir(), 'jscpd-'))
  try {
    execFileSync(
      'npx',
      ['-y', JSCPD, '--min-tokens', '100', '--min-lines', '10', '--ignore', IGNORE.join(','),
        '--reporters', 'json', '--output', output, '--silent', ...SOURCES],
      { stdio: ['ignore', 'ignore', 'inherit'] },
    )
    return JSON.parse(readFileSync(join(output, 'jscpd-report.json'), 'utf8')).duplicates
  } finally {
    rmSync(output, { recursive: true, force: true })
  }
}

const base = option('base', 'origin/develop')
const max = Number(option('max', '3'))
const changed = changedLines(base)
const newLines = [...changed.values()].reduce((sum, lines) => sum + lines.size, 0)

if (newLines === 0) {
  console.log(`No new code against ${base}: nothing to check.`)
  process.exit(0)
}

const duplicated = new Map()
const touching = []
for (const clone of clones()) {
  let hit = false
  for (const fragment of [clone.firstFile, clone.secondFile]) {
    const lines = changed.get(fragment.name)
    if (!lines) continue
    for (let n = fragment.start; n <= fragment.end; n += 1) {
      if (!lines.has(n)) continue
      hit = true
      if (!duplicated.has(fragment.name)) duplicated.set(fragment.name, new Set())
      duplicated.get(fragment.name).add(n)
    }
  }
  if (hit) touching.push(clone)
}

const duplicatedLines = [...duplicated.values()].reduce((sum, lines) => sum + lines.size, 0)
const share = (duplicatedLines / newLines) * 100

for (const { firstFile: a, secondFile: b, lines } of touching) {
  console.log(`- ${a.name}:${a.start}-${a.end} = ${b.name}:${b.start}-${b.end} (${lines} lines)`)
}
console.log(
  `Duplicated lines on new code: ${duplicatedLines} of ${newLines} (${share.toFixed(1)}%, limit ${max}%) against ${base}.`,
)

if (share > max) {
  console.error('Over the limit: move the shared logic to one place (frontend/shared for web + mobile) before the PR.')
  process.exit(1)
}
