import { describe, expect, it } from 'vitest'
import { normalizeSwiftPackagePaths } from '../scripts/normalize-ios-paths.mjs'

describe('iOS package paths generated on Windows', () => {
  it('makes plugin dependency paths valid on Mac without changing the remote package', () => {
    const source = String.raw`.package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.1.0"),
        .package(name: "CapacitorApp", path: "..\..\..\node_modules\@capacitor\app")`
    const normalized = normalizeSwiftPackagePaths(source)
    expect(normalized).toContain('path: "../../../node_modules/@capacitor/app"')
    expect(normalized).toContain('url: "https://github.com/ionic-team/capacitor-swift-pm.git"')
    expect(normalizeSwiftPackagePaths(normalized)).toBe(normalized)
  })

  it('leaves other Swift string escapes untouched', () => {
    const source = String.raw`let description = "first\nsecond"`
    expect(normalizeSwiftPackagePaths(source)).toBe(source)
  })
})
