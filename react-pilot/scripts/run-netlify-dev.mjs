#!/usr/bin/env node
/**
 * Always run `netlify dev` with cwd = react-pilot (this package root).
 * Otherwise `npm --prefix react-pilot run dev` from the monorepo root can leave cwd on the
 * repo root, Netlify never reads `react-pilot/netlify.toml`, and `/api/*` returns
 * "Function not found" even though something is listening on :8888.
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pilotRoot = path.resolve(__dirname, '..')
process.chdir(pilotRoot)

const env = { ...process.env }
if (env.VITE_OPEN === undefined) env.VITE_OPEN = '0'

// Linked Netlify sites often have repo root above `react-pilot/`; without this, the CLI
// looks for `../netlify/functions` (empty) and every `/.netlify/functions/*` returns 404.
const child = spawn('npx', ['netlify', 'dev', '--functions', 'netlify/functions'], {
  stdio: 'inherit',
  shell: true,
  env,
  cwd: pilotRoot,
})
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})
