# Todoer: iPhone beta direction

September 14, 2026. This updates the September 12 audit and plan following the user's confirmation: the household uses iPhones, a shared task app currently sees little use from other household members, and the intended first distribution is TestFlight. Earlier verification remains a historical record.

Local checks are recorded in the [September 14 verification](verification-2026-09-14.md): 154 tests and iOS asset preparation pass; a compiled iPhone build and device delivery are still unverified.

## Product decision

**Make personal follow-through useful before depending on a partner joining.** Recommended promise to test: capture something quickly, choose how it reminds you, and act or postpone with very little effort.

Evidence: the user wants persistent reminders, and an existing shared app gets little use from other household members. That does not establish why. Ask a prospective partner user about the last real household task and what they actually used: a text, paper, memory, or a conversation. A cleaner invitation cannot fix lack of interest in maintaining a task list.

Judgment: start with the user, then 5–10 iPhone testers who already dismiss reminders and forget the task. Run a two-week small beta after the reliability gates below. Look for people voluntarily returning, examples of a task the app helped them remember, and whether reminders feel controllable. Record late, missing and stale alerts alongside successes. These are proposed learning measures, not validated market demand or growth forecasts.

TestFlight helps distribute builds and collect feedback. Recruiting people and giving them a reason to keep using the app are separate jobs. Apple's public links are links you promote through your own channels. [Apple TestFlight, undated, checked September 14, 2026](https://developer.apple.com/testflight/).

## Scope and sequence

| Stage | Include | Gate before expanding |
| --- | --- | --- |
| Phone reliability prototype | Existing tasks/capture/detail; personal Inbox reminder opt-in; Done/Snooze/Reschedule; a standalone notification test | Compile on Mac and observe actual iPhone delivery and cancellation |
| First useful personal beta | Dependable save/reopen; visibly handled failed/offline changes; quick capture; reminder controls and queue limits; simple Today/Lists navigation | Correct database access and policies, durable task changes, functioning sign-in, device checks |
| Next beta increment | Daily commitments with one occurrence system and preserved history; existing recoverable focus timer as a secondary task action | Atomic recurrence, local-date/time-zone rules, history migration, native focus-end behavior |
| After user evidence | One shared list with assignment, acceptance and completion updates; optional predefined encouragement | A willing partner, secure memberships, conflict/retry handling and individual notification consent |
| Defer | Chatbot, paid motivational AI, complex statistics, matrix and extra board systems | A concrete recurring problem that simpler controls cannot solve |

Daily remains part of the intended product, but should not delay the first reminder experiment. Keep existing sharing, habits and completion history during development. Do not turn their current scaffolding into beta promises.

Navigation proposal:

    Today                         Search / Settings
    Date and any save/reminder problem
    Add a task...
    Overdue / Today
      Done checkbox · title · time · personal reminder state
    Task detail: Done · Snooze · Reschedule, then optional details
    Bottom navigation: Today · Lists

Add Daily as a third destination once occurrences and history work correctly. Focus opens from a task, with a compact way back to an active session. Existing task rows, detail, capture and timer are reusable. Calendar, Matrix and Stats should leave primary navigation in the later UI stage; this preparation stage does not remove them.

## What this stage implements

- Adds the saved Capacitor iOS project and pins its runtime to 8.1.0, matching the installed core/CLI. It uses the existing React interface; there is no framework rewrite.
- Targets iPhone device family in both Xcode configurations. Display name stays Todoer; the Xcode scheme is App. The existing login callback URL scheme is declared in Info.plist.
- Adds ios:prepare and ios:open commands. A sync hook fixes Windows separators emitted by Capacitor in Swift package dependency paths, so subsequent syncs preserve valid Mac paths.
- Replaces the old recreate-project/signing script with an explicit, unsigned simulator compile workflow. It uses the saved SPM project, Xcode 26.3 and test-only public configuration. It neither signs nor uploads an app; it has not been run remotely.
- Separates iOS scheduling from Android's conservative interval floor: iPhone requests 1/2/5/10/15/30/60-minute intervals. The iPhone phone-test button requests alerts at 1, 2 and 3 minutes. It is explicit and cancellable, including cancellation while permission is being requested.
- Retains per-account/device/task opt-in, quiet hours, obsolete reminder cancellation, one-shot delivery ownership and task-linked focus suppression. Standard iOS notification sound is requested for opted-in task alerts and the probe; normal phone sound and notification settings still apply.

## What iPhone reminders currently mean

The implementation queues **at most 32 task alerts total**, looking no more than 24 hours ahead. That is an app design limit, not a claim about a universal Apple limit. For one overdue task at one-minute intervals, that is roughly half an hour of queued alerts, not a full day. Multiple tasks share that budget; later tasks may have no queued slot until Todoer refreshes. Reopening refreshes the queue.

The installed Capacitor local-notifications 8.0.2 Swift implementation submits these as one-off UNTimeIntervalNotificationTrigger requests, with no repeating trigger. Its 60-second guard for repeating triggers is not evidence that a JavaScript process can run every minute after termination. Local notifications do not need a reminder server once submitted. [Capacitor local notifications, checked September 14](https://capacitorjs.com/docs/apis/local-notifications).

| State | Current behavior / limitation to test |
| --- | --- |
| Open | App can refresh the finite native queue; in-app reminders use the selected interval |
| Locked, backgrounded, terminated | Previously submitted local alerts are the intended delivery mechanism; no running JavaScript or unlimited replenishment is assumed |
| Offline | Already submitted alerts do not need a network. Task saving/completion still depends on the current database-backed design; reliable offline completion is unfinished |
| Done / Snooze / Reschedule on a notification | Actions open Todoer. Confirm the task is loaded and the operation succeeds, then verify obsolete pending and delivered alerts are removed. Do not label a failed save complete |
| Focus, Silent mode, Scheduled Summary, restricted notifications | Normal system settings can silence, delay or prevent alerts; the app must not promise to bypass them |
| Quiet hours / travel | Planning uses device local time. Already queued alerts are fixed timestamps; a time-zone change while closed does not cause JavaScript to re-plan. Reopening reconciles; travel while closed remains a release test |
| Shared or other list tasks | Native background reminders remain limited to owned Inbox tasks. List reminders need an open, connected app; shared stale-reminder cancellation remains unfinished |
| Task-linked focus session | Planner suppresses that task's reminders until the saved focus deadline. Real background recovery and end-of-focus alerts still need device work |

Apple introduced AlarmKit in iOS 26 for prominent, separately authorized alarms that can break through Silent mode and Focus. It is a candidate for a small native experiment after the ordinary notification trial, not an implemented capability or proof of indefinite nagging. Evaluate stop/snooze and cancellation carefully before requiring a newer OS. [Apple WWDC25 session, June 2025, checked September 14, 2026](https://developer.apple.com/videos/play/wwdc2025/230/).

## TestFlight path and cost

Apple lists Developer Program membership at **US$99/year**. A free account can test on the owner's device through Xcode; TestFlight distribution needs the paid membership. No membership or service was purchased. [Apple Developer Program, checked September 14](https://developer.apple.com/programs/).

External testers such as ordinary friends receive an invite or public link; the first external build goes through beta review. A build expires after 90 days. Internal testing refers to App Store Connect team users, not a shortcut requiring friends to become administrators. [Apple TestFlight overview, checked September 14](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview).

Capacitor v8 documents iOS 15+ and Xcode 26+. Windows can prepare assets and the project, but cannot run Xcode. Use a Mac with Xcode for the first signed device build; a hosted Mac is another option with cost/access to resolve before use. [Capacitor iOS guide, checked September 14](https://capacitorjs.com/docs/ios). The checked GitHub macOS 15 runner includes Xcode 26.3, selected explicitly in the workflow. [GitHub runner image, checked September 14](https://github.com/actions/runner-images/blob/main/images/macos/macos-15-Readme.md).

On a Mac, after npm ci and setting the intended public Supabase configuration in .env.local:

    npm run ios:prepare
    npm run ios:open

Use the App target, select the account's signing team and iPhone, and run. The bundle identifier com.todoer.app is a current placeholder until ownership/availability is confirmed in the intended Apple account. For the first beta, use Xcode Organizer to validate and archive with a unique build number, then review the concrete build and tester notes before uploading. A simulator compile with example.supabase.co is never a distributable build.

## Remaining gates

1. Restore access to the intended Supabase project and inspect its real schema/security before migrations. The existing lookup failed; no data or credentials were replaced. Atomic recurrence and durable retry/offline handling remain necessary even with one user.
2. Validate native sign-in on cold launch, confirmation-email return, error recovery and sign-out. Declaring the URL scheme alone does not verify the OAuth flow or the backend redirect allowlist.
3. Run the iPhone test matrix below. Inspect OS pending requests as well as visible alerts: the installed plugin resolves its schedule promise before each asynchronous Apple add-request callback finishes. JavaScript success alone is insufficient evidence of acceptance.
4. Before inviting testers, finish app identity/icon (currently generated template assets), review the archive's privacy manifest/report and actual data declarations, provide feedback contact and review credentials, and verify account lifecycle. [Capacitor privacy-manifest guidance, checked September 14](https://capacitorjs.com/docs/ios/privacy-manifest). These checks apply to this app's actual account/data/SDK use.

## Device verification worksheet — not yet run

Record iPhone model, exact iOS version, build, notification permission, sound/Focus/Summary settings, expected time, observed time and outcome.

- Run the 1/2/3-minute probe locked, then with the app terminated, then offline. Cancel before the next alert; repeat while the permission prompt is open.
- For a timed Inbox task, test Done, delete, Snooze and Reschedule both in the app and from a locked notification. Relaunch and verify task state and no obsolete alerts. Repeat offline and with a rejected database write.
- Leave one overdue one-minute task unopened until the finite queue ends; reopen and verify replenishment without a burst. Test several simultaneous tasks and a later one-shot reminder.
- Revoke permission; test Silent mode, Focus and Scheduled Summary. Restore permission and check the status shown in Todoer.
- Cross quiet-hours boundaries, midnight and a device time-zone change. Avoid changing a real daily habit until its migration exists.
- Start a task-linked focus session; lock, terminate and reopen. Verify recovered time, no duplicate session completion, suppression of that task's reminders, and explicit behavior when the focus period ends.

**Next priority:** a compiled build on the user's iPhone and observed reminder/cancellation results, alongside access to the intended database. TestFlight recruitment follows dependable basic use.
