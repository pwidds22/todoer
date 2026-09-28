# Todoer: consumer audit and release direction

**September 14 update:** see the [iPhone beta direction](iphone-beta-2026-09-14.md) for the user's platform decision, revised personal-first experiment and iPhone scheduling changes. The audit below records the earlier code and research; its household-first release sequence is superseded.

September 12, 2026. Research accessed September 12, 2026 (some tool timestamps are September 13 UTC). This is a development assessment, not a release certification. See the [implementation plan](plans/2026-09-12-consumer-foundation.md) and [verification record](verification-2026-09-12.md).

## Recommendation

Build **a calm shared household list with personal reminders that help you follow through**. The switching hypothesis is less work coordinating with a partner and deciding what to do when a reminder appears. Feature breadth alone is a weak pitch: established competitors already cover most of the proposed checklist.

The first useful test is one household list, clear ownership, quick capture, Done/Snooze/Reschedule, personal reminder consent, and a short Daily list. Keep the existing simple focus timer. Recruit 3–5 pairs for two weeks after the data and phone reliability gates pass. Observe invitation completion, successful shared completion, unexpected alerts, postponement effort, and whether both people voluntarily return. These are proposed measures, not evidence of demand. Compare the same workflows against the pair's existing app before asking them to switch.

## What the code actually contains

| Area | Useful implementation to keep | Gaps and release implications |
| --- | --- | --- |
| Architecture | Next.js static export, React, TypeScript, Tailwind, TanStack Query, Zustand, Supabase, Capacitor Android wrapper | Suitable for this stage. Static export has no Next server to run secret-bearing AI calls or a reminder scheduler. A different UI framework would not remove phone restrictions. |
| Tasks | Inbox, Today, Upcoming, detail editing, subtasks, priorities, recurrence, projects, labels, search | Database-backed CRUD exists. Before this change, writes could fail without clear feedback, recurring Undo matched by title, and repeating completion could create duplicates. Client fixes improve this; server transactions and persistent retry IDs remain necessary. |
| Storage/account | Supabase records; browser query cache; local UI preferences | Live schema, membership rules and row access policies are unverified. No schema migrations are checked in under `supabase/`. The original service worker could cache authenticated API responses. This change isolates account caches and excludes those responses. There is still no durable offline task store or sync outbox. |
| Reminders | Existing foreground nag component, service-worker push receiver, native push registration scaffold | Previously no native local scheduler. Native push code only logged a token; no working sender is established by this repo. Stage 1 adds local scheduling and cancellation. Phone delivery remains untested. |
| Sharing | Project sharing UI, membership hooks and shared visibility queries | This is scaffolding, not verified partner collaboration. No complete tested invitation acceptance, explicit task assignee workflow, secure membership policies, conflict protocol or realtime completion cancellation. |
| Daily/Habits | Habit list and completion-history table interface; preferred times and streak display | Separate habit and task systems disagree on recurrence/reminder behavior. Habit reminder fields are not connected to the new scheduler. Do not relabel this as a finished Daily feature or discard its existing completion history. |
| Focus | Focus/break controls, task association, settings and progress display | Replaced decrement-only timing with a saved deadline and completion ledger. Recovery now works in automated and mocked browser checks. A native end-of-session alarm is not implemented. |
| Capture | `chrono-node`, repeat/priority/project parsing, Quick Add | Now has an editable interpretation and visible ambiguity. Single-task capture only. Parsed labels are explicitly flagged as unsupported in capture; no paid AI or speech service. |
| Secondary screens | Calendar, Matrix, Stats, Settings, Login | Keep available during development. Their existence does not establish accuracy, accessibility or a polished release. They currently crowd the navigation. |
| Build | Working static export and Android/iOS CI scaffolding | Baseline compiled. Updated vulnerable production dependencies and Node/Java CI versions. Android SDK/Java build tooling was unavailable locally; iOS signing and AlarmKit need a Mac/toolchain. Neither native binary was verified here. |

Key code: `src/hooks/useTasks.ts`, `src/lib/task-mutations.ts`, `src/lib/recurrence.ts`, `src/components/NagReminder.tsx`, `src/lib/reminders/`, `src/hooks/useFocusTimer.ts`, `src/lib/focus-timer.ts`, `src/lib/nlp.ts`, `src/components/tasks/QuickAdd.tsx`, `src/hooks/useSharing.ts`, `src/app/app/habits/page.tsx`, `src/types/database.ts`, and `public/sw.js`.

Read-only inspection of the configured Supabase project timed out; project lookup returned not found. That may mean the connection targets an unavailable or inaccessible project. It does **not** prove the real database is empty. No live records, policies or credentials were changed. Restoring access to the intended project is necessary before a safe migration.

## Competitors: missing versus difficult to use

Official documents establish supported features; they do not establish delivery reliability on your phones. This research did not run side-by-side phone trials.

| Product | Evidence | Implication for Todoer |
| --- | --- | --- |
| TickTick | Its [official feature page](https://www.ticktick.com/features) lists constant reminders, recurring tasks, natural-language/voice capture, sharing and assignment, habits, and focus tools. Page undated; accessed September 12. | Sharing and persistent reminders are existing features. A clearer invitation or reminder workflow is a usability hypothesis, not a missing-feature claim. Platform behavior still needs comparison on the same phones. |
| Todoist | [Reminder documentation](https://www.todoist.com/help/todoist/features/introduction-to-reminders-9PezfU), updated September 1, 2026, covers recurring/custom reminders and snoozing. [Urgent reminders](https://www.todoist.com/help/todoist/features/add-an-urgent-reminder-in-todoist-WeBYdY5ra), updated August 28, support alarms on iOS 26+ and Android, across plans with differing limits. Standalone recurring urgent reminders are unavailable on Android in that document. | “Todoist has no urgent reminders” is outdated. Its docs do not establish an indefinite every-minute overdue loop after dismissal. Distinguish a recurring task, a recurring reminder, and an alarm that remains active. The Urgent setting is inside the reminder, which can also create a discovery problem. |
| Due | The developer's [App Store listing](https://apps.apple.com/us/app/due-reminders-timers/id390017969), accessed September 12, describes 1/5/10/15/30/60-minute auto-snooze, offline reminders and natural date parsing. Its footnote says five repeats by default, configurable up to ten, with replenishment when opening or acting on a notification. | This is the closest benchmark for postponement speed and persistence. Its indefinite wording is conditional. Its documented sync is across the user's devices; this source does not establish household assignment. Do not promise Todoer unlimited background delivery just because Due's headline sounds unlimited. |
| Apple Reminders | [Apple's guide](https://support.apple.com/en-us/105124), May 27, 2026, documents shared lists, assignment, completion activity controls, and personal reminders that are not shared. | A serious built-in baseline for Apple households. Personal notification control is already a useful precedent. Sharing alone will not justify another app. |
| Any.do Family | [Shared-space setup](https://support.any.do/en/articles/8610805-how-to-create-and-set-up-a-shared-space-in-any-do-family-workspace), March 16, 2026, covers invitations, assignment, private personal space, and a family space for four members/four boards. | Household organization is an established category. Todoer can test whether one obvious shared list is easier than configuring spaces and boards; that is our judgment, not a measured Any.do flaw. |
| Microsoft To Do | [Microsoft's shared assignment guide](https://support.microsoft.com/en-us/office/assign-tasks-in-shared-lists-1b12ff41-f204-4a2c-975d-edbf631a4b34), undated, accessed September 12, documents assigning tasks within shared lists. | Another baseline for straightforward shared lists. There is no reason to build elaborate team roles for a two-person first release. |

Recent user accounts are mixed. A [TickTick sharing discussion](https://www.reddit.com/r/ticktick/comments/1w7ohc4/is_ticktick_good_for_simple_task_sharing/) displayed eight days old at retrieval: one person wanted account-free sharing, another reported that a free shared list worked well with their partner, and others said family members did not open the lists. A [notification settings discussion](https://www.reddit.com/r/ticktick/comments/1uhxu6f/how_to_use_normal_notifications_instead_of/) displayed two months old and showed confusion between repeating notifications, sustained alarms and per-task settings. A [Todoist discussion](https://www.reddit.com/r/todoist/comments/1wbe53l/notification_without_condition/) displayed four days old and described confusion about getting a new daily reminder when yesterday's occurrence was unfinished. Dates are relative as exposed by the retrieved pages, not independently verified exact publication dates.

These anecdotes suggest testable problems: invitation friction, people not returning, unclear reminder settings, and yesterday's task blocking today's routine. They do not demonstrate that most users dislike either app. Due's surfaced App Store reviews were mainly older; they were not treated as recent representative research. No adherence or medical claims follow from this evidence.

## Reminder contract

**Implemented in Stage 1:** personal, device-local opt-in per timed task; once or persistent; requested intervals of 1/2/5/10/15/30/60 minutes; quiet hours default 22:00–07:00; Snooze 10 minutes; cancel/replace reminders on local edits, completion and deletion; suppress the selected task during an active focus interval. A task's due time alone no longer turns on nagging. Existing database nag flags are preserved but do not silently enable the new personal settings. Existing users must explicitly enable reminders on each device.

In a visible app, JavaScript checks the plan every second. Browser suspension can delay it; reopening does not generate a backlog. The browser has no supported closed-app reminder sender in this project. Native scheduling uses at most 32 slots within a 24-hour planning window and replenishes while the app can run. The queue is shared across tasks, so a frequent overdue task can shorten coverage. It is not 32 repeats guaranteed for every task.

Android's [Doze documentation](https://developer.android.com/training/monitoring-device-state/doze-standby), accessed September 12, limits allow-while-idle alarms to no more than one per nine minutes **per app**. Stage 1 requests at least ten minutes between a task's native repeats; multiple tasks can still be delayed by the app-wide quota. This is a conservative experiment, not proof of exact delivery. An indefinite one-minute Android background promise is not supportable with the current implementation.

The [Capacitor notification guide](https://capacitorjs.com/docs/apis/local-notifications), accessed September 12, documents Android notification/exact-alarm permissions and restrictions. Disabling exact alarms can remove scheduled exact alerts. Private Space and notification settings can block them. Local schedules do not need internet once installed, but a disconnected phone cannot learn that another device completed a task. Force-stop, reboot, battery saver, process removal and denied permissions must be tested separately.

Only the owner's **Inbox** tasks receive native background schedules in this stage. Other lists receive foreground alerts only after a recent successful fetch. This intentionally leaves shared background reminders unfinished until personal server subscriptions and stale-state handling exist. Even with a backend, an offline phone cannot guarantee immediate remote cancellation; the release must explain that instead of claiming instant synchronization.

iOS has a different opportunity: [Apple's AlarmKit session](https://developer.apple.com/videos/play/wwdc2025/230/) (WWDC 2025) and [alarm scheduling documentation](https://developer.apple.com/documentation/AlarmKit/scheduling-an-alarm-with-alarmkit) describe native alarm support. Todoer's current plugin integration does not implement AlarmKit. An iPhone release needs its own prototype and real-device validation; Android results cannot certify it. Choose the target phones before committing to a native alarm strategy.

## Sharing: simplest dependable design

Keep Supabase for authentication, membership and task records. Make one Household list with a visible **Invite partner** button. A single-use, expiring invitation link opens an acceptance screen naming the list and permissions; the recipient signs in before joining. The app can open the operating system's share sheet so the user chooses how to send it. Do not add an internal messenger. A second member can edit/complete tasks, while only the owner manages invitations and deletion of the list.

Separate creator from owner-of-work: each task has Me, Partner or Unassigned. Assignment never enables reminders. Each member owns their reminder subscription and device permission. Shared completion cancels both members' schedules once their devices receive authoritative state. Editing a due date invalidates the old revision and replans only existing consenting subscriptions. Snooze is personal; Reschedule changes the shared task's date and shows who changed it. Leaving a list cancels that member's reminders and removes future access.

Use database transactions for completion plus the next occurrence, unique occurrence IDs, and stable mutation IDs for retries. Require the revision the editor saw; a stale editor gets a conflict with their draft preserved. Completion racing with an edit needs an explicit conflict result, not silent reopening or duplicate next tasks. Keep a durable local pending-operation store before calling offline edits supported. Realtime messages prompt refetching; reconnecting always refetches even if a realtime message was missed.

For shared background notifications, initially send from authoritative server state rather than preloading days of uncancellable shared alarms. Expire pending deliveries, and recheck status before acting. This can improve freshness, but network delivery still cannot guarantee every minute. Test cancellation across two phones, and choose an explicit bounded offline fallback only after measuring its stale-alert risk.

Cost: the existing stack avoids another database vendor. [Supabase pricing](https://supabase.com/pricing), accessed September 12, lists Free at $0 and Pro from $25/month with the first project included. Free projects can pause after inactivity; they are suitable for a prototype, not a promise of an always-available service. Production budgeting should also allow for email delivery, hosting, store accounts and usage above included quotas. Local reminders and local parsing add no per-alert or AI bill. No service was purchased or upgraded here.

## Daily: one occurrence system, distinct experience

Proposed release behavior, **not yet implemented or migrated**:

- A daily template produces one task occurrence per chosen local calendar date, enforced by a unique template/date key. Daily is a focused view of those tasks, sharing completion and reminders with ordinary tasks.
- Completing today's occurrence records its actual timestamp and timezone without changing past history. Tomorrow exists independently of whether today was completed. Opening after several days reconciles missing dates without sending accumulated reminders.
- At midnight an unfinished day becomes “Not completed”; it does not remain a permanent overdue pile. History can be corrected deliberately. Show “3 of 5 this week,” not “You failed.” Skip is a separate intentional state. No fabricated completions.
- Snooze changes this occurrence's reminder, not the template. Snoozing past midnight offers “Skip today” or moving the preferred time instead of silently transferring credit. Pausing stops new reminders/occurrences from the pause date and retains prior history; resuming starts with today.
- Default to the device's local time for personal daily commitments. Store the occurrence's date and IANA timezone when created. On travel, show the new timezone and move only future schedules; revisiting a calendar date does not create a duplicate. For a shared household daily item, use one explicit household timezone so two travelers do not disagree about its date.
- For a daylight-saving gap, use the next valid local time. For the repeated autumn hour, schedule once at the first occurrence. Test both transitions and crossing the date line. Existing date/time fields are not sufficient to guarantee this travel contract without a schema change.

Export and map existing `habits` and `habit_completions` before migration. Validate totals and sample histories, then make the old and new views read the same records. Keeping two independent completion engines would create precisely the confusion this feature is supposed to solve.

## Focus, capture and optional motivation

Focus now saves an end timestamp while running and remaining duration while paused. A session that ended while the app was closed is counted once when reopened, then waits at the next phase; it does not invent a chain of completed sessions. Only the attached task's reminders pause during a running focus session; other tasks retain their own choices. Pause, break, finish or unlink allows its reminders again. Ordinary manual system-clock changes still affect wall-clock deadlines; do not claim a stopwatch-grade monotonic clock across process death. No native focus-completion alarm is shipped in this stage.

Keep one fast capture box with an editable preview. “Call the dentist tomorrow at 10 and remind me every minute until it's done” now exposes the AM/PM choice before saving and previews personal persistence. Review date/time, recurrence, list and interval; uncertain multiple-task text is flagged rather than automatically split. Later, allow keyboard dictation into the same box and preview each proposed task in a batch. This needs no chatbot. A chat screen would add navigation and conversational state without helping the main capture workflow.

Start with local parsing: no model API charge, no task text sent to an AI provider, and immediate fallback editing. If real capture examples demonstrate a useful accuracy gap, trial an explicit “Interpret with AI” action behind an authenticated server function. Keep its API key server-side, send only the entered text and necessary date/time context, validate structured output, cap usage, set a timeout, and retain the local/manual preview on failure. Cost depends on model and input/output volume; do not invent a fixed cost before measuring. Network latency and provider processing of task text are additional tradeoffs. AI must never silently create, invite, complete, or reschedule.

Encouragement should start with optional predefined text after user testing. Proposed controls: Off (default), Practical or Warm, and “after focus,” “daily summary,” or both with at most one message per day. Mute directly from each message and disable in Settings. Examples: after focus, “Session finished. Take a break or choose your next step”; daily summary, “You made time for two commitments today”; after a missed day when opening Daily, “Today is a fresh page. Choose what fits.” These acknowledge recorded actions and offer a next step. They do not infer mood, invoke a partner's disappointment, or claim to improve adherence. Paid generated motivation is unnecessary for this release.

## Navigation and release scope

```text
Today                         Search · Profile
Saturday, September 12
[ Add a task…                              + ]
[ Sync or reminder problem, only if needed  ]

Due today
○ Call dentist           10:00 · Me · Repeat
○ Order pet food         18:00 · Partner

Daily                       2 of 3 completed →
○ Read for ten minutes

       Today          Daily          Lists
                     [+ Add]
```

Desktop uses the same hierarchy in a sidebar. Lists contains Inbox, personal lists, and Household with Invite partner visible. Keep Upcoming under Lists, search in the header, and Focus reachable from a task or small timer shortcut. Keep existing task rows/detail/Quick Add; evolve Habits only after migration. Calendar, Matrix and Stats become secondary destinations after usage testing. Stage 1 preserves those screens and fixes navigation rather than pretending a full redesign is finished.

**Essential:** saved-versus-failed task actions, secure household sharing, consent and cancellation, supported reminder delivery, Daily history and a simple recoverable timer. **After testing:** import, widgets, dictation, multiple-task previews, optional predefined encouragement, deeper calendar use. **Speculative:** chatbot, AI coaching, social streak pressure, advanced statistics, more board systems and matrix expansion.

The next priority is an Android reminder trial on the actual target phones, alongside restoring read-only access to the intended Supabase project. Then implement and test shared transactional data before Daily migration and visual simplification. Those dependencies make a dependable first release smaller; skipping them only makes a demo look complete.
