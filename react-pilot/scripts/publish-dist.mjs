import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const pilotRoot = path.resolve(__dirname, '..')
const distDir = path.join(pilotRoot, 'dist')
const shareRoot = path.resolve(pilotRoot, '..', 'pilot-share')

async function publish() {
  await rm(shareRoot, { recursive: true, force: true })
  await mkdir(shareRoot, { recursive: true })
  await cp(distDir, shareRoot, { recursive: true })

  const generatedAt = new Date().toISOString()
  const readme = [
    'UxS Metadata React Pilot - Share Package',
    '',
    `Generated at: ${generatedAt}`,
    '',
    'This folder contains static build output and can be served from any standard web server.',
    '',
    'Quick local preview:',
    'python3 -m http.server 4173 --directory pilot-share',
    '',
    'Then open:',
    '  - http://localhost:4173/  (React pilot)',
    '',
    'Note: Opening index.html directly as file:// may fail in some browsers due to module security.',
    'Same-origin /api/db is not available from this static folder unless you proxy it — use the deployed site or netlify dev for host-backed actions.',
    'QA: use PRODUCTION_QA_RUNBOOK.md Appendix A for this folder.',
  ].join('\n')

  await writeFile(path.join(shareRoot, 'README.txt'), readme, 'utf8')

  console.log(`Published pilot build to: ${shareRoot}`)
}

publish().catch((error) => {
  console.error('Failed to publish pilot build:', error)
  process.exit(1)
})
