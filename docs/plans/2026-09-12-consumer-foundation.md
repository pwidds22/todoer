# Todoer consumer foundation — staged implementation

**September 14 update:** the user confirmed iPhone-only first and weak partner adoption of their existing shared app. The [iPhone beta plan](../iphone-beta-2026-09-14.md) now prioritizes personal reminder testing before shared-list expansion. The completed foundation work below remains applicable.

Date: September 12, 2026. This plan supersedes conflicting product promises in SPEC.md; it does not authorize a production migration or deployment.

## Recommendation

Test a calm household task list with personal, persistent reminders and a small daily commitments area. The reason to switch is less effort coordinating and following through, not a larger feature count. This is a hypothesis, not evidence of demand.

Keep Next.js, React, Supabase, Capacitor, task components, chrono-node, recurrence controls, and the timer UI. Rewriting the app in another framework would delay learning without removing operating-system limits.

## First release

Essential: capture/edit/complete/postpone; clearly saved versus failed changes; reminders with personal consent, quiet hours and reliable cancellation; one shared list with ownership and completion updates; daily occurrences/history; a recoverable simple focus timer. Test reminders on real target phones before polishing secondary screens.

After testing: imports, widgets, OS dictation, multiple-task preview, optional predefined encouragement, optional calendar view.

Speculative: chatbot, generated motivational coaching, advanced analytics, matrix, multiple board systems, complex gamification. Existing secondary screens can remain accessible during development; they should not dominate the release navigation.

## Stage 1 — local reliability foundation (this change)

- [x] Add focused automated tests and fix the invalid lint command; preserve a reproducible lockfile.
- [x] Use one Supabase client, isolate account caches, stop caching authenticated API responses in the service worker, surface failed writes.
- [x] Test/fix local calendar recurrence, prevent repeated completion creating duplicates, remove title-based recurring undo. Document the remaining database transaction requirement.
- [x] Replace per-task foreground intervals with a tested reminder planner. Explicit device/account/task consent; 1/2/5/10/15/30/60 minute options; quiet hours; snooze; cancellation on edit/complete/delete; task-linked focus suppression. Native local notifications use a finite queue. Browser alerts only while open; explain both honestly.
- [x] Restore the focus timer using a stored end time and remaining duration when paused, keeping the existing screen. Test recovery and completion idempotency.
- [x] Improve capture preview for explicit persistent-reminder wording and ambiguous time; never silently enable nagging merely because a time was parsed.
- [x] Fix list navigation for static export and verify core UI with synthetic data, not real user task writes.
- [x] Record checks and outstanding device/database validation in the [audit](../consumer-audit-2026-09-12.md) and [verification record](../verification-2026-09-12.md).

## Stage 2 — dependable shared data (requires access to the configured database)

Export actual schema, policies, triggers and migrations first. Do not invent or overwrite production schema from the stale SPEC. Add transactional completion with occurrence IDs and unique constraints, mutation IDs for retries, revisions for conflict detection, per-user reminder subscriptions, and membership policies. Preserve legacy tasks/habits through a reviewed migration and backup. Test as two users plus an outsider before enabling shared reminders. Add realtime invalidation and reconnect refetch; realtime is a prompt to fetch authoritative state, not the only record of changes.

## Stage 3 — daily + release experience

Use one task occurrence/reminder/completion system. A daily template yields one occurrence per local calendar date, with a unique (template, date) key and preserved history. Migrate existing habits rather than discarding their completions. Complete, skip, pause and snooze have distinct meanings. Then simplify the primary navigation and trial with 3–5 pairs for two weeks.

## Navigation proposal

Mobile: Today / Daily / Lists. Add is always available. Search in the header; Settings via profile; Focus from a task or a small timer shortcut. Desktop retains the sidebar with the same hierarchy.

Today: date and optional sync/reminder problem banner; fast capture; overdue and due-today tasks; compact daily commitments progress. A task row shows checkbox, title, time, owner (Me/Partner/Unassigned), and reminder state. Task detail has Done, Snooze and Reschedule above optional details.

Lists: Inbox, personal lists, and shared household list with a visible Invite partner action. Keep current task list/detail/quick-add components. Evolve Habits into Daily only after data migration. Keep Upcoming under Lists; move Calendar, Matrix and Stats out of primary navigation.

## Verification / decisions

- Baseline `npx tsc --noEmit` and `npm run build` pass.
- No AGENTS.md or CLAUDE.md found in the repository or checked parent directories. SPEC.md and February mobile plans were read as existing design context, not proof of implemented behavior.
- Preserve pre-existing `.claude/settings.local.json` modification and untracked `nul` file.
- Read-only Supabase inspection timed out; project lookup returned not found. Security rules, live migrations and shared writes cannot yet be verified. Do not change credentials to another project without user direction.
- Android tooling is absent from PATH. A JavaScript build cannot establish lock-screen notification reliability.
- User authorized routine reversible implementation in this session; no extra design approval gate is needed. Work stays local on `codex/reliability-foundation`.
