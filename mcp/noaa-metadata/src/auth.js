#!/usr/bin/env node
import { runAuthFlow } from './googleDrive.js'

runAuthFlow().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
