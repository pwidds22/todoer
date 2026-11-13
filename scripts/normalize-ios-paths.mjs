import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Capacitor 8 emits Windows separators in Swift local package paths. */
export function normalizeSwiftPackagePaths(source) {
  return source.replace(/(\bpath:\s*")([^"]*)(")/g, (_, prefix, path, suffix) =>
    prefix + path.replaceAll('\\', '/') + suffix
  )
}

// Runs after cap sync ios; Android sync must not touch the iOS project.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) &&
    (!process.env.CAPACITOR_PLATFORM_NAME || process.env.CAPACITOR_PLATFORM_NAME === 'ios')) {
  const manifest = new URL('../ios/App/CapApp-SPM/Package.swift', import.meta.url)
  const source = await readFile(manifest, 'utf8')
  const normalized = normalizeSwiftPackagePaths(source)
  if (source !== normalized) await writeFile(manifest, normalized)
}
