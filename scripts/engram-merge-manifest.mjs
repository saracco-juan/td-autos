#!/usr/bin/env node
// Git merge driver for engram/<name>/.engram/manifest.json.
// Both branches only append chunk entries, so the merge is the union of chunks by id, oldest first.
// Usage (set by `git config merge.engram-manifest.driver`): node scripts/engram-merge-manifest.mjs %O %A %B
// Git reads the result from %A; exit 0 means resolved, non-zero leaves the conflict to the developer.
import { readFileSync, writeFileSync } from 'node:fs'

const [, , basePath, oursPath, theirsPath] = process.argv

const read = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return { version: 1, chunks: [] }
  }
}

try {
  const ours = read(oursPath)
  const theirs = read(theirsPath)
  const base = read(basePath)

  const byId = new Map()
  for (const chunk of [...base.chunks, ...ours.chunks, ...theirs.chunks]) {
    if (!byId.has(chunk.id)) byId.set(chunk.id, chunk)
  }
  const chunks = [...byId.values()].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))

  writeFileSync(oursPath, `${JSON.stringify({ ...ours, version: ours.version ?? 1, chunks }, null, 2)}\n`)
  process.exit(0)
} catch (error) {
  console.error(`engram-merge-manifest: ${error.message}`)
  process.exit(1)
}
