import { access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const workspaceRoot = path.resolve(__dirname, '..', '..')
const shareDir = path.join(workspaceRoot, 'pilot-share')

function timestamp() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mi = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`
}

async function packageShare() {
  await access(shareDir)

  const zipName = `pilot-share-${timestamp()}.zip`
  const zipPath = path.join(workspaceRoot, zipName)

  await execFileAsync('zip', ['-r', '-q', zipPath, 'pilot-share'], {
    cwd: workspaceRoot,
  })

  console.log(`Created zipped share package: ${zipPath}`)
}

packageShare().catch((error) => {
  console.error('Failed to package pilot share folder:', error)
  process.exit(1)
})
