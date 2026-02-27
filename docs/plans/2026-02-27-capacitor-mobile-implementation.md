# Capacitor Mobile App Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wrap the existing Next.js Todoer PWA as native iOS and Android apps using Capacitor, with GitHub Actions CI/CD for building and uploading to both app stores.

**Architecture:** Capacitor wraps the statically-exported Next.js app in native WebView shells. The web code runs locally on device. Native plugins bridge to real push notifications, status bar, haptics. GitHub Actions macOS runners handle iOS builds (developer is Windows-only).

**Tech Stack:** Capacitor 7, @capacitor/cli, @capacitor/ios, @capacitor/android, @capacitor/push-notifications, @capacitor/status-bar, @capacitor/splash-screen, @capacitor/haptics, @capacitor/keyboard, @capacitor/app, @capacitor/browser, GitHub Actions, Fastlane (optional)

---

### Task 1: Next.js Static Export Configuration

**Files:**
- Modify: `next.config.ts`
- Modify: `src/app/page.tsx`
- Delete: `src/middleware.ts`
- Delete: `src/lib/supabase/server.ts`

**Step 1: Update next.config.ts for static export**

Replace `next.config.ts` with:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  reactStrictMode: true,
  images: {
    unoptimized: true, // Required for static export
  },
};

export default nextConfig;
```

Note: We remove the `turbopack.root` config — it's dev-only and not needed. We add `images.unoptimized` because Next.js Image Optimization requires a server.

**Step 2: Replace server-side root redirect with client-side**

Replace `src/app/page.tsx` with:

```tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/app/today')
  }, [router])

  return null
}
```

The previous `redirect()` was a server function — incompatible with static export.

**Step 3: Delete server-only files**

```bash
rm src/middleware.ts
rm src/lib/supabase/server.ts
```

These files use `next/headers` (cookies) and `NextResponse.redirect` — both server-only APIs that don't exist in static export. The middleware auth logic will be replaced by AuthGuard in Task 2.

**Step 4: Test the static export builds**

```bash
npx next build
```

Expected: Build succeeds with `output: 'export'`, generates `out/` directory with static HTML/JS/CSS.

If there are errors about server-only imports, they'll point to exactly which files need updating.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: configure Next.js static export for Capacitor

- Add output: 'export' to next.config.ts
- Replace server redirect with client-side router.replace
- Remove middleware.ts (server-only, replaced by AuthGuard)
- Remove server.ts Supabase client (unused without middleware)"
```

---

### Task 2: Client-Side Auth Guard

**Files:**
- Create: `src/components/AuthGuard.tsx`
- Modify: `src/app/app/layout.tsx`

**Step 1: Create the AuthGuard component**

Create `src/components/AuthGuard.tsx`:

```tsx
'use client'

import { useAuth } from '@/hooks/useAuth'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && !user && pathname.startsWith('/app')) {
      router.replace('/login')
    }
  }, [user, loading, pathname, router])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return <>{children}</>
}
```

This replaces what `middleware.ts` did: redirect unauthenticated users from `/app/*` to `/login`.

**Step 2: Wrap the app layout with AuthGuard**

In `src/app/app/layout.tsx`, add AuthGuard around the entire layout. Change the import section and wrap the return:

Add import at top:
```tsx
import { AuthGuard } from '@/components/AuthGuard'
```

Wrap the return JSX with `<AuthGuard>`:
```tsx
return (
  <AuthGuard>
    <div className="flex h-screen overflow-hidden">
      {/* ... existing layout content ... */}
    </div>
  </AuthGuard>
)
```

**Step 3: Build and verify**

```bash
npx next build
```

Expected: Successful static export. The `out/` directory should contain `app/today/index.html`, `login/index.html`, etc.

**Step 4: Commit**

```bash
git add src/components/AuthGuard.tsx src/app/app/layout.tsx
git commit -m "feat: add client-side AuthGuard to replace server middleware

Redirects unauthenticated users to /login with a loading spinner
while auth state resolves."
```

---

### Task 3: Install Capacitor & Initialize Native Projects

**Files:**
- Create: `capacitor.config.ts`
- Modify: `package.json` (via npm install)
- Generated: `android/` directory
- Note: `ios/` directory will be generated by GitHub Actions (macOS required)

**Step 1: Install Capacitor core + CLI**

```bash
npm install @capacitor/core
npm install -D @capacitor/cli
```

**Step 2: Initialize Capacitor config**

Create `capacitor.config.ts`:

```ts
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.todoer.app',
  appName: 'Todoer',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#0a0a0a',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0a0a',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'Todoer',
  },
}

export default config
```

Key config values:
- `webDir: 'out'` — points to the Next.js static export output
- `appId: 'com.todoer.app'` — the bundle identifier for both stores
- `server.androidScheme: 'https'` — needed for cookies/localStorage to work correctly on Android

**Step 3: Install platform packages**

```bash
npm install @capacitor/android
```

We skip `@capacitor/ios` for now — it generates an Xcode project that requires macOS. The iOS platform will be added during the GitHub Actions build.

**Step 4: Build web and add Android platform**

```bash
npx next build
npx cap add android
npx cap sync android
```

Expected: `android/` directory is created with a full Android Studio project. `cap sync` copies the `out/` contents into the Android project's assets.

**Step 5: Install Capacitor plugins**

```bash
npm install @capacitor/app @capacitor/browser @capacitor/haptics @capacitor/keyboard @capacitor/push-notifications @capacitor/splash-screen @capacitor/status-bar
npx cap sync android
```

**Step 6: Add npm scripts to package.json**

Add these to the `"scripts"` section of `package.json`:

```json
"cap:sync": "next build && cap sync",
"cap:android": "next build && cap sync android && cap open android",
"cap:build": "next build && cap sync"
```

**Step 7: Add `ios/` and `android/` to .gitignore considerations**

The `android/` directory SHOULD be committed to git — it contains configuration that gets customized (splash screens, icons, deep link config, google-services.json, etc.). Same for `ios/` when it's generated.

**Step 8: Commit**

```bash
git add capacitor.config.ts package.json package-lock.json android/
git commit -m "feat: initialize Capacitor with Android platform

- Add capacitor.config.ts with app ID, plugins, and platform settings
- Add Android native project
- Install Capacitor core, CLI, and native plugins"
```

---

### Task 4: Platform-Aware Utilities

**Files:**
- Create: `src/lib/native/platform.ts`
- Create: `src/lib/native/notifications.ts`
- Modify: `src/components/ServiceWorkerRegistration.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Create platform detection utility**

Create `src/lib/native/platform.ts`:

```ts
import { Capacitor } from '@capacitor/core'

export const isNative = () => Capacitor.isNativePlatform()
export const isIOS = () => Capacitor.getPlatform() === 'ios'
export const isAndroid = () => Capacitor.getPlatform() === 'android'
export const isWeb = () => Capacitor.getPlatform() === 'web'
```

**Step 2: Create platform-aware push notification setup**

Create `src/lib/native/notifications.ts`:

```ts
import { isNative } from './platform'

export async function initPushNotifications() {
  if (!isNative()) {
    // On web, use existing Service Worker push (no changes needed)
    return
  }

  // Dynamic import to avoid loading native modules on web
  const { PushNotifications } = await import('@capacitor/push-notifications')

  let permStatus = await PushNotifications.checkPermissions()

  if (permStatus.receive === 'prompt') {
    permStatus = await PushNotifications.requestPermissions()
  }

  if (permStatus.receive !== 'granted') {
    console.warn('[Push] Permission denied')
    return
  }

  await PushNotifications.register()

  PushNotifications.addListener('registration', (token) => {
    console.log('[Push] Native token:', token.value)
    // TODO: Send token to your backend to store for this user
    // This replaces the web-push subscription endpoint
  })

  PushNotifications.addListener('registrationError', (error) => {
    console.error('[Push] Registration error:', error.error)
  })

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('[Push] Received:', notification)
  })

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    console.log('[Push] Action:', action.actionId)
    // Navigate to the relevant task/page based on notification data
    if (action.notification.data?.url) {
      window.location.href = action.notification.data.url
    }
  })
}
```

**Step 3: Skip Service Worker on native**

Modify `src/components/ServiceWorkerRegistration.tsx` — add platform check at the top of the useEffect:

```tsx
import { isNative } from '@/lib/native/platform'
```

Then in the useEffect, add early return:

```tsx
useEffect(() => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  if (isNative()) return // Native apps don't need a Service Worker

  // ... rest of existing SW registration code
}, [])
```

**Step 4: Initialize native plugins in layout**

Modify `src/app/layout.tsx` — add a new component that initializes native plugins:

Create `src/components/NativeInit.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { isNative } from '@/lib/native/platform'

export function NativeInit() {
  useEffect(() => {
    if (!isNative()) return

    const init = async () => {
      // Status bar
      const { StatusBar, Style } = await import('@capacitor/status-bar')
      await StatusBar.setStyle({ style: Style.Dark })
      await StatusBar.setBackgroundColor({ color: '#0a0a0a' })

      // Keyboard
      const { Keyboard } = await import('@capacitor/keyboard')
      Keyboard.addListener('keyboardWillShow', () => {
        document.body.classList.add('keyboard-open')
      })
      Keyboard.addListener('keyboardWillHide', () => {
        document.body.classList.remove('keyboard-open')
      })

      // App state — refetch data when returning from background
      const { App } = await import('@capacitor/app')
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          // TanStack Query will refetch on window focus by default
          window.dispatchEvent(new Event('focus'))
        }
      })

      // Push notifications
      const { initPushNotifications } = await import('@/lib/native/notifications')
      await initPushNotifications()

      // Splash screen — hide after init
      const { SplashScreen } = await import('@capacitor/splash-screen')
      await SplashScreen.hide()
    }

    init().catch(console.error)
  }, [])

  return null
}
```

Add `<NativeInit />` to `src/app/layout.tsx` body, next to `<ServiceWorkerRegistration />`:

```tsx
<ServiceWorkerRegistration />
<NativeInit />
```

**Step 5: Build and verify**

```bash
npx next build
npx cap sync android
```

Expected: Build succeeds, no import errors.

**Step 6: Commit**

```bash
git add src/lib/native/ src/components/NativeInit.tsx src/components/ServiceWorkerRegistration.tsx src/app/layout.tsx
git commit -m "feat: add platform-aware native initialization

- Platform detection utilities (isNative, isIOS, isAndroid, isWeb)
- Native push notification registration via Capacitor
- Skip Service Worker on native platforms
- Status bar, keyboard, app state, splash screen initialization
- NativeInit component in root layout"
```

---

### Task 5: OAuth Deep Linking for Native

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `android/app/src/main/AndroidManifest.xml`
- Modify: `android/app/src/main/res/values/strings.xml` (if needed)

**Step 1: Update Google OAuth redirect for native**

In `src/app/login/page.tsx`, update the `handleGoogleLogin` function:

```tsx
import { isNative } from '@/lib/native/platform'

async function handleGoogleLogin() {
  if (isNative()) {
    // On native, use in-app browser for OAuth, redirect back via deep link
    const { Browser } = await import('@capacitor/browser')
    const redirectTo = 'com.todoer.app://login-callback'

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true, // Don't let Supabase redirect automatically
      },
    })

    if (error) {
      setError(error.message)
      return
    }

    if (data.url) {
      await Browser.open({ url: data.url })
    }
  } else {
    // Web: existing behavior
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/app/today`,
      },
    })
    if (error) setError(error.message)
  }
}
```

**Step 2: Handle the deep link callback**

Add a useEffect in the login page to listen for the OAuth callback:

```tsx
useEffect(() => {
  if (!isNative()) return

  const handleDeepLink = async () => {
    const { App } = await import('@capacitor/app')
    App.addListener('appUrlOpen', async ({ url }) => {
      // URL will be: com.todoer.app://login-callback#access_token=...
      if (url.includes('login-callback')) {
        // Extract tokens from the URL fragment
        const hashParams = new URLSearchParams(url.split('#')[1] || '')
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          router.push('/app/today')
        }

        // Close the in-app browser
        const { Browser } = await import('@capacitor/browser')
        await Browser.close()
      }
    })
  }

  handleDeepLink()
}, [router, supabase])
```

**Step 3: Configure Android deep link in AndroidManifest.xml**

In `android/app/src/main/AndroidManifest.xml`, add an intent filter inside the `<activity>` tag:

```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="com.todoer.app" />
</intent-filter>
```

**Step 4: Add the redirect URL to Supabase**

In the Supabase dashboard > Authentication > URL Configuration, add `com.todoer.app://login-callback` to the list of allowed redirect URLs.

**Step 5: Commit**

```bash
git add src/app/login/page.tsx android/app/src/main/AndroidManifest.xml
git commit -m "feat: add OAuth deep linking for native Google sign-in

- Use @capacitor/browser for in-app OAuth flow on native
- Handle deep link callback to extract and set auth session
- Configure Android intent filter for com.todoer.app:// scheme"
```

---

### Task 6: App Icons & Splash Screen Assets

**Files:**
- Create: `resources/icon.png` (1024x1024)
- Create: `resources/icon-foreground.png` (1024x1024, for Android adaptive icon)
- Create: `resources/splash.png` (2732x2732)
- Modify: Various Android resource files

**Step 1: Generate PNG icon from SVG**

The existing SVG at `public/icons/icon-512x512.svg` is a purple rounded rect with a checkmark. We need to convert this to a 1024x1024 PNG.

Use a Node.js script or online converter. The icon needs:
- `resources/icon.png` — 1024x1024 solid icon (used for iOS and as base)
- `resources/icon-foreground.png` — 1024x1024 just the checkmark on transparent background (Android adaptive icon foreground layer)
- `resources/splash.png` — 2732x2732 with centered icon on dark background (#0a0a0a)

Since we're on Windows without sharp/imagemagick, use the `@capacitor/assets` tool:

```bash
npm install -D @capacitor/assets
```

Place the source icon at `resources/icon.png` and splash at `resources/splash.png`, then run:

```bash
npx capacitor-assets generate --android
```

This auto-generates all the required Android icon sizes and splash screen sizes.

**Step 2: Verify generated resources**

Check that `android/app/src/main/res/` now has icon files in `mipmap-*` directories and splash screens in `drawable-*` directories.

**Step 3: Commit**

```bash
git add resources/ android/app/src/main/res/
git commit -m "feat: generate app icons and splash screens for Android

- 1024x1024 source icon and 2732x2732 splash screen
- Auto-generated Android resources via @capacitor/assets"
```

---

### Task 7: Android Build Configuration

**Files:**
- Modify: `android/app/build.gradle`
- Create: Android signing keystore (local, not committed)

**Step 1: Generate a release signing keystore**

```bash
keytool -genkey -v -keystore todoer-release.keystore -alias todoer -keyalg RSA -keysize 2048 -validity 10000
```

Store this file securely. Do NOT commit it to git. You'll upload it as a GitHub Secret for CI.

**Step 2: Configure release signing in build.gradle**

In `android/app/build.gradle`, add signing config for release builds. This will use environment variables (set in CI) or local properties:

```gradle
android {
    signingConfigs {
        release {
            if (System.getenv("ANDROID_KEYSTORE_BASE64")) {
                storeFile file("release.keystore")
                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ANDROID_KEY_ALIAS")
                keyPassword System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

**Step 3: Test a local debug build**

```bash
npx cap sync android
cd android && ./gradlew assembleDebug
```

Expected: `android/app/build/outputs/apk/debug/app-debug.apk` is generated.

**Step 4: Commit**

```bash
git add android/app/build.gradle
git commit -m "feat: configure Android release signing and build"
```

---

### Task 8: GitHub Actions — Android CI/CD

**Files:**
- Create: `.github/workflows/build-android.yml`

**Step 1: Create Android build workflow**

Create `.github/workflows/build-android.yml`:

```yaml
name: Build Android

on:
  push:
    branches: [master]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17

      - name: Install dependencies
        run: npm ci

      - name: Build web
        run: npx next build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}

      - name: Sync Capacitor
        run: npx cap sync android

      - name: Decode keystore
        if: env.ANDROID_KEYSTORE_BASE64 != ''
        run: echo "$ANDROID_KEYSTORE_BASE64" | base64 -d > android/app/release.keystore
        env:
          ANDROID_KEYSTORE_BASE64: ${{ secrets.ANDROID_KEYSTORE_BASE64 }}

      - name: Build release AAB
        working-directory: android
        run: ./gradlew bundleRelease
        env:
          ANDROID_KEYSTORE_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          ANDROID_KEY_ALIAS: ${{ secrets.ANDROID_KEY_ALIAS }}
          ANDROID_KEY_PASSWORD: ${{ secrets.ANDROID_KEY_PASSWORD }}

      - name: Upload AAB artifact
        uses: actions/upload-artifact@v4
        with:
          name: app-release.aab
          path: android/app/build/outputs/bundle/release/app-release.aab
```

**Step 2: Set up GitHub Secrets**

The following secrets need to be added to the GitHub repo (Settings > Secrets):

- `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — your Supabase anon key
- `ANDROID_KEYSTORE_BASE64` — base64-encoded keystore file (`base64 -w 0 todoer-release.keystore`)
- `ANDROID_KEYSTORE_PASSWORD` — keystore password
- `ANDROID_KEY_ALIAS` — key alias (e.g., `todoer`)
- `ANDROID_KEY_PASSWORD` — key password

**Step 3: Commit**

```bash
git add .github/workflows/build-android.yml
git commit -m "ci: add GitHub Actions workflow for Android builds

Builds release AAB on push to master. Signing via GitHub Secrets."
```

---

### Task 9: GitHub Actions — iOS CI/CD

**Files:**
- Create: `.github/workflows/build-ios.yml`

**Step 1: Create iOS build workflow**

Create `.github/workflows/build-ios.yml`:

```yaml
name: Build iOS

on:
  push:
    branches: [master]
  workflow_dispatch:

jobs:
  build:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Install iOS platform
        run: |
          npm install @capacitor/ios
          npx cap add ios

      - name: Build web
        run: npx next build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}

      - name: Sync Capacitor
        run: npx cap sync ios

      - name: Configure iOS deep linking
        run: |
          # Add URL scheme to Info.plist
          /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes array" ios/App/App/Info.plist || true
          /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0 dict" ios/App/App/Info.plist || true
          /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" ios/App/App/Info.plist || true
          /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string com.todoer.app" ios/App/App/Info.plist || true

      - name: Install Apple certificate and provisioning profile
        env:
          BUILD_CERTIFICATE_BASE64: ${{ secrets.IOS_BUILD_CERTIFICATE_BASE64 }}
          P12_PASSWORD: ${{ secrets.IOS_P12_PASSWORD }}
          BUILD_PROVISION_PROFILE_BASE64: ${{ secrets.IOS_PROVISION_PROFILE_BASE64 }}
          KEYCHAIN_PASSWORD: ${{ secrets.IOS_KEYCHAIN_PASSWORD }}
        run: |
          CERTIFICATE_PATH=$RUNNER_TEMP/build_certificate.p12
          PP_PATH=$RUNNER_TEMP/build_pp.mobileprovision
          KEYCHAIN_PATH=$RUNNER_TEMP/app-signing.keychain-db

          echo -n "$BUILD_CERTIFICATE_BASE64" | base64 --decode -o $CERTIFICATE_PATH
          echo -n "$BUILD_PROVISION_PROFILE_BASE64" | base64 --decode -o $PP_PATH

          security create-keychain -p "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH
          security set-keychain-settings -lut 21600 $KEYCHAIN_PATH
          security unlock-keychain -p "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH

          security import $CERTIFICATE_PATH -P "$P12_PASSWORD" -A -t cert -f pkcs12 -k $KEYCHAIN_PATH
          security set-key-partition-list -S apple-tool:,apple: -k "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH
          security list-keychain -d user -s $KEYCHAIN_PATH

          mkdir -p ~/Library/MobileDevice/Provisioning\ Profiles
          cp $PP_PATH ~/Library/MobileDevice/Provisioning\ Profiles

      - name: Build iOS archive
        run: |
          xcodebuild -workspace ios/App/App.xcworkspace \
            -scheme App \
            -sdk iphoneos \
            -configuration Release \
            -archivePath $RUNNER_TEMP/App.xcarchive \
            archive \
            CODE_SIGN_STYLE=Manual \
            PROVISIONING_PROFILE_SPECIFIER="${{ secrets.IOS_PROVISION_PROFILE_NAME }}" \
            CODE_SIGN_IDENTITY="Apple Distribution"

      - name: Export IPA
        run: |
          cat > $RUNNER_TEMP/ExportOptions.plist << 'PLIST'
          <?xml version="1.0" encoding="UTF-8"?>
          <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
          <plist version="1.0">
          <dict>
              <key>method</key>
              <string>app-store</string>
              <key>teamID</key>
              <string>${{ secrets.IOS_TEAM_ID }}</string>
              <key>signingStyle</key>
              <string>manual</string>
              <key>provisioningProfiles</key>
              <dict>
                  <key>com.todoer.app</key>
                  <string>${{ secrets.IOS_PROVISION_PROFILE_NAME }}</string>
              </dict>
          </dict>
          </plist>
          PLIST

          xcodebuild -exportArchive \
            -archivePath $RUNNER_TEMP/App.xcarchive \
            -exportPath $RUNNER_TEMP/export \
            -exportOptionsPlist $RUNNER_TEMP/ExportOptions.plist

      - name: Upload IPA artifact
        uses: actions/upload-artifact@v4
        with:
          name: App.ipa
          path: ${{ runner.temp }}/export/*.ipa

      - name: Clean up keychain
        if: ${{ always() }}
        run: security delete-keychain $RUNNER_TEMP/app-signing.keychain-db
```

**Step 2: iOS GitHub Secrets needed**

- `IOS_BUILD_CERTIFICATE_BASE64` — Apple Distribution certificate (.p12), base64-encoded
- `IOS_P12_PASSWORD` — password for the .p12 certificate
- `IOS_PROVISION_PROFILE_BASE64` — App Store provisioning profile, base64-encoded
- `IOS_PROVISION_PROFILE_NAME` — name of the provisioning profile
- `IOS_KEYCHAIN_PASSWORD` — any random string for the temporary keychain
- `IOS_TEAM_ID` — your Apple Developer Team ID

**Step 3: Commit**

```bash
git add .github/workflows/build-ios.yml
git commit -m "ci: add GitHub Actions workflow for iOS builds

Builds on macOS runner, signs with Apple Distribution cert,
exports IPA for App Store upload."
```

---

### Task 10: Safe Styles for Native (Safe Area Insets)

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/app/layout.tsx`

**Step 1: Add safe area CSS**

In `src/app/globals.css`, add:

```css
/* Safe area insets for native (iPhone notch, Android gesture bar) */
:root {
  --safe-area-top: env(safe-area-inset-top, 0px);
  --safe-area-bottom: env(safe-area-inset-bottom, 0px);
  --safe-area-left: env(safe-area-inset-left, 0px);
  --safe-area-right: env(safe-area-inset-right, 0px);
}
```

**Step 2: Apply safe area padding to app layout**

In `src/app/app/layout.tsx`, update the root div:

```tsx
<div className="flex h-screen overflow-hidden" style={{
  paddingTop: 'var(--safe-area-top)',
  paddingBottom: 'var(--safe-area-bottom)',
}}>
```

**Step 3: Add viewport-fit=cover to layout.tsx**

In `src/app/layout.tsx`, update the viewport export:

```ts
export const viewport: Viewport = {
  themeColor: '#7c3aed',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover', // Enables safe-area-inset-* env variables
}
```

**Step 4: Commit**

```bash
git add src/app/globals.css src/app/app/layout.tsx src/app/layout.tsx
git commit -m "feat: add safe area inset support for native devices

Handles iPhone notch and Android gesture bar with CSS env() variables."
```

---

### Task 11: Local Android Testing

**Step 1: Connect Android device or start emulator**

Option A (physical device): Enable Developer Options > USB Debugging on your Android phone, connect via USB.

Option B (emulator): Open Android Studio, go to Device Manager, create a virtual device.

**Step 2: Build and run**

```bash
npm run cap:sync
npx cap run android
```

Or open in Android Studio:
```bash
npx cap open android
```

Then click the Run button (green play icon) in Android Studio.

**Step 3: Test checklist**

- [ ] App opens with splash screen then shows login or today view
- [ ] Login with email/password works
- [ ] Google OAuth opens in-app browser, redirects back to app
- [ ] Tasks load and display correctly
- [ ] Creating a new task works and appears immediately
- [ ] Completing/uncompleting tasks works
- [ ] Status bar styled correctly (dark with matching background)
- [ ] Keyboard pushes content up, doesn't overlap inputs
- [ ] Pull to refresh or app resume refetches data
- [ ] Back button works for navigation (doesn't exit app immediately)

**Step 4: Iterate on any issues found**

Fix issues, rebuild, retest. Each fix gets its own commit.

---

### Task 12: App Store & Play Store Setup (User Tasks)

These require manual action in browser — cannot be automated:

**Google Play Console:**
1. Go to https://play.google.com/console
2. Create new app: name "Todoer", free, category Productivity
3. Complete store listing: description, screenshots, icon
4. Upload the AAB from GitHub Actions artifacts (or local build)
5. Complete content rating questionnaire
6. Set up pricing & distribution
7. Submit for review

**Apple App Store Connect:**
1. Go to https://appstoreconnect.apple.com
2. Create new app: name "Todoer", bundle ID `com.todoer.app`, SKU `todoer`
3. Complete app information: description, keywords, screenshots, icon
4. Upload the IPA (via GitHub Actions or Transporter app on macOS)
5. Complete App Review information
6. Submit for review

**Supabase Configuration:**
1. Add `com.todoer.app://login-callback` to Supabase Auth > URL Configuration > Redirect URLs
2. If using FCM for Android push: add Firebase project and upload `google-services.json`

---

## Summary of All Commits

1. `feat: configure Next.js static export for Capacitor`
2. `feat: add client-side AuthGuard to replace server middleware`
3. `feat: initialize Capacitor with Android platform`
4. `feat: add platform-aware native initialization`
5. `feat: add OAuth deep linking for native Google sign-in`
6. `feat: generate app icons and splash screens for Android`
7. `feat: configure Android release signing and build`
8. `ci: add GitHub Actions workflow for Android builds`
9. `ci: add GitHub Actions workflow for iOS builds`
10. `feat: add safe area inset support for native devices`
11. (testing — no commit unless fixes needed)
12. (store setup — manual user tasks)
