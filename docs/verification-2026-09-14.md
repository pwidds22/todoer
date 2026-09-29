# iPhone preparation verification

September 14, 2026. Follow-up to the [September 12 foundation checks](verification-2026-09-12.md), implementing the [iPhone beta direction](iphone-beta-2026-09-14.md).

## Passed locally on Windows

- npm test: **154 tests across 12 files passed**, including the existing persistence/mutation, recurrence, reminder cancellation and focus recovery tests. New coverage checks iOS versus Android intervals, finite queue/horizon, probe cancellation during permission prompting, standard iOS sound and portable Swift dependency paths.
- npm run typecheck: passed. The production build subsequently ran TypeScript again.
- npm run ios:prepare: passed. Next.js 16.3.5 exported all 18 pages and Capacitor synced all eight installed native plugins into the saved iOS project.
- The sync hook ran successfully: all eight local Swift package paths use forward slashes after a real Windows sync, despite the CLI generating Windows separators.
- Xcode project parsed with the installed xcode parser. Both target configurations select iPhone device family. Info.plist and shared App scheme parsed as XML; callback URL scheme and target reference match the app.
- npm audit --omit=dev: zero reported vulnerabilities.
- git diff --check: passed. Git printed Windows line-ending conversion notices.

The Vitest configuration still emits the previously documented non-blocking warning about a future Vite configuration-loader default. A supplementary YAML parser check could not run because neither yaml nor js-yaml is installed; the workflow was reviewed as text, not executed or certified by a GitHub workflow validator.

## Explicitly unverified

- Xcode compilation, simulator launch, native signing/archive and Apple review. Windows asset preparation is not an iPhone binary build.
- The manual GitHub Mac workflow has not run. It compiles an unsigned simulator target with example backend configuration; it does not create a usable TestFlight build or upload anything.
- Physical iPhone alert timing, sound, termination/offline delivery, notification actions, quiet hours and time-zone transitions. Use the device worksheet in the beta plan.
- Live Supabase schema/policies, task persistence against that backend, sign-in callbacks and confirmation links. Prior access failures remain unresolved.
- Durable offline task changes, atomic recurring completion, unified Daily history and dependable shared completion/reminder cancellation remain unfinished.

The normal iPhone notification path requests one-minute intervals in a finite **32-alert total queue**. At one minute for one overdue task this is roughly half an hour, with less coverage when other tasks share the queue. No indefinite delivery claim, AlarmKit integration or bypass of phone settings is implemented.

## Boundaries

Changes remain local on codex/reliability-foundation. No real task records, database schema, Apple account, billing or deployed app were changed. Existing Android support and useful task/sharing/habit code remain. Native assets are generated placeholders and still need Todoer branding before tester distribution.

Next: obtain a Mac build and real iPhone results, and restore read-only access to the intended backend before data migration or broader beta distribution.
