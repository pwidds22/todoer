# Todoer - Technical Specification

## Vision
A personal task management app that **refuses to let you forget**. The killer feature is persistent nagging reminders that ping every minute until you act. Built as a modern PWA with the depth of Todoist, the features TickTick wishes it had, and the design clarity of Things 3.

**Audience**: Personal use first, architected for multi-user from day one.
**Cost**: $0/month (Supabase free tier + Vercel free tier).

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 15 (App Router) | SSR, API routes, great DX |
| UI | Tailwind CSS + shadcn/ui | Beautiful, accessible, fast to build |
| Database | Supabase (PostgreSQL) | Free tier, auth, RLS, realtime |
| Auth | Supabase Auth | Email/password + OAuth (Google) |
| State | TanStack Query + Zustand | Server state + client state |
| Notifications | Web Push API + Supabase Edge Functions | Persistent reminders |
| PWA | Serwist (next-pwa successor) | Installable, offline, push |
| Drag & Drop | @dnd-kit | Reordering tasks, kanban |
| Dates | date-fns | Lightweight date manipulation |
| NLP | chrono-node | Natural language date parsing |
| Deployment | Vercel | Zero-config, edge functions |

---

## Database Schema

### `profiles`
Extends Supabase auth.users.
```sql
id          UUID PRIMARY KEY REFERENCES auth.users(id)
display_name TEXT
avatar_url   TEXT
timezone     TEXT DEFAULT 'America/New_York'
settings     JSONB DEFAULT '{}'  -- app preferences
created_at   TIMESTAMPTZ DEFAULT now()
updated_at   TIMESTAMPTZ DEFAULT now()
```

### `projects`
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE
parent_id   UUID REFERENCES projects(id) ON DELETE CASCADE  -- nested projects
name        TEXT NOT NULL
description TEXT
color       TEXT DEFAULT '#6366f1'  -- hex color
icon        TEXT  -- emoji or icon name
position    INTEGER DEFAULT 0  -- sort order
is_archived BOOLEAN DEFAULT false
is_favorite BOOLEAN DEFAULT false
view_type   TEXT DEFAULT 'list'  -- 'list' | 'board' | 'calendar'
created_at  TIMESTAMPTZ DEFAULT now()
updated_at  TIMESTAMPTZ DEFAULT now()
```

### `sections`
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
project_id  UUID REFERENCES projects(id) ON DELETE CASCADE
name        TEXT NOT NULL
position    INTEGER DEFAULT 0
is_collapsed BOOLEAN DEFAULT false
created_at  TIMESTAMPTZ DEFAULT now()
```

### `labels`
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE
name        TEXT NOT NULL
color       TEXT DEFAULT '#6366f1'
position    INTEGER DEFAULT 0
created_at  TIMESTAMPTZ DEFAULT now()
```

### `tasks`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE
project_id      UUID REFERENCES projects(id) ON DELETE SET NULL
section_id      UUID REFERENCES sections(id) ON DELETE SET NULL
parent_id       UUID REFERENCES tasks(id) ON DELETE CASCADE  -- subtasks
title           TEXT NOT NULL
description     TEXT  -- markdown supported
priority        INTEGER DEFAULT 0  -- 0=none, 1=low, 2=medium, 3=high, 4=urgent
due_date        DATE
due_time        TIME
start_date      DATE  -- Things 3 feature Todoist lacks!
start_time      TIME
duration_minutes INTEGER  -- estimated duration
completed_at    TIMESTAMPTZ
is_completed    BOOLEAN DEFAULT false
position        INTEGER DEFAULT 0
-- Recurring task fields
recurrence_rule TEXT  -- RRULE string (RFC 5545)
recurrence_type TEXT  -- 'fixed' | 'after_completion'
-- Reminder/notification fields
reminder_enabled BOOLEAN DEFAULT true
nag_enabled     BOOLEAN DEFAULT false  -- THE killer feature
nag_interval    INTEGER DEFAULT 60  -- seconds between nags (default 1 min)
snooze_until    TIMESTAMPTZ  -- if snoozed, don't nag until this time
-- Metadata
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

### `task_labels`
```sql
task_id  UUID REFERENCES tasks(id) ON DELETE CASCADE
label_id UUID REFERENCES labels(id) ON DELETE CASCADE
PRIMARY KEY (task_id, label_id)
```

### `reminders`
Separate reminders table for multiple custom reminders per task.
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
task_id     UUID REFERENCES tasks(id) ON DELETE CASCADE
remind_at   TIMESTAMPTZ  -- absolute time
relative    INTEGER  -- minutes before due (alternative to remind_at)
is_sent     BOOLEAN DEFAULT false
created_at  TIMESTAMPTZ DEFAULT now()
```

### `push_subscriptions`
Stores Web Push API subscription objects per device.
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE
subscription    JSONB NOT NULL  -- PushSubscription object
device_name     TEXT
is_active       BOOLEAN DEFAULT true
created_at      TIMESTAMPTZ DEFAULT now()
```

### `habits`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE
name            TEXT NOT NULL
description     TEXT
color           TEXT DEFAULT '#10b981'
icon            TEXT  -- emoji
frequency_type  TEXT DEFAULT 'daily'  -- 'daily' | 'weekly' | 'custom'
frequency_days  INTEGER[]  -- [1,3,5] for Mon/Wed/Fri (ISO weekday)
target_count    INTEGER DEFAULT 1  -- times per day/period
reminder_time   TIME
nag_enabled     BOOLEAN DEFAULT false
position        INTEGER DEFAULT 0
is_archived     BOOLEAN DEFAULT false
created_at      TIMESTAMPTZ DEFAULT now()
```

### `habit_completions`
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
habit_id    UUID REFERENCES habits(id) ON DELETE CASCADE
completed_at TIMESTAMPTZ DEFAULT now()
count       INTEGER DEFAULT 1  -- for habits with target_count > 1
date        DATE DEFAULT CURRENT_DATE
```

### `pomodoro_sessions`
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE
task_id     UUID REFERENCES tasks(id) ON DELETE SET NULL
started_at  TIMESTAMPTZ DEFAULT now()
ended_at    TIMESTAMPTZ
duration    INTEGER NOT NULL  -- planned duration in seconds
actual      INTEGER  -- actual seconds worked
type        TEXT DEFAULT 'focus'  -- 'focus' | 'short_break' | 'long_break'
completed   BOOLEAN DEFAULT false
```

### `activity_log`
For gamification and stats.
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE
action      TEXT NOT NULL  -- 'task_completed' | 'habit_completed' | 'pomo_completed' | 'streak'
entity_id   UUID  -- reference to task/habit/etc
points      INTEGER DEFAULT 0
metadata    JSONB DEFAULT '{}'
created_at  TIMESTAMPTZ DEFAULT now()
```

---

## Row Level Security (RLS)

Every table gets RLS enabled with policies:
```sql
-- Example for tasks table (same pattern for all user-owned tables)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own tasks"
ON tasks FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

---

## App Structure & Routes

```
/                           → Redirect to /app/today
/login                      → Auth page (login/signup)
/app                        → Main app layout (sidebar + content)
  /app/inbox                → Inbox (tasks with no project)
  /app/today                → Today view
  /app/upcoming             → Upcoming 7 days
  /app/calendar             → Calendar view (month/week/day)
  /app/matrix               → Eisenhower Matrix
  /app/project/[id]         → Project view (list/board/calendar)
  /app/label/[id]           → Tasks filtered by label
  /app/filters              → Custom filters / Smart Lists
  /app/habits               → Habit tracker
  /app/focus                → Pomodoro timer
  /app/stats                → Statistics & gamification
  /app/settings             → User settings
```

---

## Sidebar Navigation

```
┌─────────────────────────┐
│  📥 Inbox          (3)  │
│  ☀️ Today          (7)  │
│  📅 Upcoming       (12) │
│  📆 Calendar            │
│  🎯 Matrix              │
│  ──────────────────     │
│  PROJECTS               │
│  ▸ 🏠 Personal          │
│  ▸ 💼 Work              │
│  ▸ 🏋️ Fitness           │
│  + Add Project          │
│  ──────────────────     │
│  LABELS                 │
│  🔴 urgent              │
│  🔵 waiting             │
│  🟢 someday             │
│  ──────────────────     │
│  🔁 Habits              │
│  🍅 Focus               │
│  📊 Stats               │
│  ⚙️ Settings            │
└─────────────────────────┘
```

---

## Feature Specifications

### F1: Task CRUD
- **Create**: Quick add bar at top of every view. Supports natural language: "Buy groceries tomorrow at 5pm #personal @errands p2"
  - `#` → project
  - `@` → label
  - `p1-p4` → priority
  - Natural dates: "tomorrow", "next friday", "every monday", "in 3 days"
- **Read**: Tasks display title, due info, priority color bar, labels as chips, subtask count
- **Update**: Inline editing for title. Click to open detail panel (slide-in from right)
- **Delete**: Soft delete → trash. Auto-purge after 30 days.
- **Complete**: Checkbox click with satisfying animation. Recurring tasks auto-generate next occurrence.
- **Reorder**: Drag and drop within sections and between sections/projects.

### F2: Task Detail Panel
Slide-in panel from the right (like Todoist) with:
- Title (editable, large text)
- Description (Markdown editor)
- Due date + time pickers
- Start date + time pickers
- Duration estimate
- Priority selector (color-coded: none/gray, low/blue, medium/yellow, high/orange, urgent/red)
- Project selector
- Section selector
- Label multi-select
- Subtasks (add/reorder/complete inline)
- Reminders list (add custom reminders)
- **Nag toggle** with interval setting
- Recurrence rule builder
- Created/updated timestamps
- Delete button

### F3: Persistent Nagging Reminders (THE Feature)
**How it works:**
1. Task has `due_time` set and `nag_enabled = true`
2. At `due_time`, first notification fires via Web Push
3. Every `nag_interval` seconds (default 60), another notification fires
4. Continues until user either:
   - **Completes** the task (from notification action button or app)
   - **Snoozes** (5 min / 15 min / 30 min / 1 hour / custom)
   - **Dismisses** (stops nagging, task remains incomplete)
5. Notification shows: task title, project name, how long overdue
6. Notification action buttons: [Complete] [Snooze 15m] [Dismiss]

**Implementation:**
- **Client-side**: Service Worker handles displaying notifications + action buttons
- **Server-side**: Supabase Edge Function runs on a cron (every 30 seconds) that:
  1. Queries tasks where `nag_enabled = true` AND `due_time <= now()` AND `is_completed = false` AND (`snooze_until IS NULL` OR `snooze_until <= now()`)
  2. For each task, sends Web Push notification to all user's registered devices
  3. Tracks last notification time to respect `nag_interval`
- **Fallback**: If push fails, in-app banner + sound when app is open
- **Global setting**: Default nag on/off for new tasks, default interval
- **Per-task override**: Each task can toggle nag and set custom interval

### F4: Recurring Tasks
Support via RRULE (RFC 5545) stored as string:
- Daily / Weekly / Monthly / Yearly
- Custom intervals ("every 3 days", "every 2 weeks")
- Specific days ("every Mon, Wed, Fri")
- Complex patterns ("first Monday of each month", "last weekday")
- End conditions: never / after X occurrences / until date
- Two modes:
  - **Fixed schedule**: next occurrence based on rule regardless of completion date
  - **After completion**: next occurrence = completion date + interval

UI: Recurrence builder with presets + custom RRULE editor for power users.

### F5: Projects & Organization
- **Projects**: Name, color, icon (emoji), description, nested sub-projects
- **Sections**: Within projects, collapsible, reorderable
- **Labels**: Global, cross-project, color-coded
- **Inbox**: Default project for quick-capture tasks
- **Favorites**: Pin projects/labels to top of sidebar
- **Archive**: Hide completed projects without deleting

### F6: Views

**Today View**:
- All tasks due today or overdue
- Grouped by: Overdue / Morning / Afternoon / Evening (based on due_time)
- "Plan your day" mode: walk through each unscheduled task

**Upcoming View**:
- Next 7 days in a scrollable timeline
- Each day shows tasks sorted by time then priority
- Overdue section at top

**Calendar View** (month/week/day):
- Tasks placed on their due dates
- Drag to reschedule
- Color-coded by project
- Toggle between month/week/day

**Kanban Board**:
- Columns = sections within a project
- Drag tasks between columns
- Add new columns (sections)

**Eisenhower Matrix**:
- 4 quadrants: Urgent+Important, Important+Not Urgent, Urgent+Not Important, Neither
- Auto-classification based on priority + due date proximity
- Manual override via drag and drop

### F7: Pomodoro Timer
- **Focus page**: Large timer display, currently focused task shown
- **Settings**: Focus duration (default 25 min), short break (5 min), long break (15 min), sessions before long break (4)
- **Task integration**: Start pomo from any task, time is logged
- **Ambient sounds**: Optional (rain, café, white noise) - use free audio files
- **Strict mode**: Optional fullscreen overlay
- **Stats**: Daily/weekly focus time, average focus per day, most productive hours

### F8: Habit Tracker
- **Habit list**: Name, icon, color, frequency, current streak
- **Check-in**: Tap to complete for today. Multi-count habits show progress ring.
- **Calendar heatmap**: GitHub-style green squares showing completion history
- **Streaks**: Current streak + longest streak per habit
- **Reminders**: Per-habit reminder time with optional nag
- **Stats**: Completion rate, streak history, consistency score

### F9: Gamification & Stats
- **Points**: +10 completing task, +5 completing habit, +15 completing Pomodoro, +25 streak milestone
- **Levels**: 0-99 Beginner, 100-499 Productive, 500-999 Achiever, 1000-2499 Master, 2500+ Enlightened
- **Streaks**: Days with at least 1 task completed. Current + longest.
- **Stats dashboard**:
  - Tasks completed (today/week/month/all time)
  - Completion rate (completed / total due)
  - Most productive day of week
  - Most productive time of day
  - Tasks by project (pie chart)
  - Focus time (bar chart by day)
  - Habit consistency (line chart)
  - Priority distribution

### F10: Natural Language Input
Using `chrono-node` for date parsing + custom regex for app-specific syntax:
- "Buy milk tomorrow at 3pm" → title: "Buy milk", due: tomorrow 3pm
- "Weekly team meeting every Monday at 10am" → title: "Weekly team meeting", recurrence: weekly Mon, due_time: 10am
- "Call dentist p1 #health @calls" → title: "Call dentist", priority: 1, project: health, label: calls
- "Review PR in 2 hours" → title: "Review PR", due: now + 2h
- "Pay rent every 1st !!" → title: "Pay rent", recurrence: monthly 1st, priority: high (!! = p3)

### F11: PWA & Offline
- **Installable**: Web app manifest with icons, splash screen
- **Offline**: Service worker caches app shell + recent data
- **Background sync**: Queue changes made offline, sync when back online
- **Push notifications**: Web Push API for reminders and nags
- **App-like**: Standalone display mode, custom theme color, no browser chrome

### F12: Settings
- **Theme**: Light / Dark / System
- **Default nag**: On/Off for new tasks
- **Default nag interval**: 30s / 1m / 2m / 5m
- **Default reminder**: None / At time / 5 min before / 15 min before / 30 min before / 1 hour before
- **Snooze presets**: Customize snooze duration options
- **Start of week**: Sunday / Monday
- **Time format**: 12h / 24h
- **Date format**: MM/DD/YYYY / DD/MM/YYYY / YYYY-MM-DD
- **Timezone**: Auto-detect or manual
- **Notifications**: Enable/disable, sound on/off
- **Quick add shortcut**: Keyboard shortcut config
- **Pomodoro defaults**: Focus/break/long break durations
- **Export data**: JSON export of all data

---

## Build Phases

### Phase 1: Foundation (Build Session 1)
**Goal: Working app with the killer feature**

1. Next.js project setup with Tailwind + shadcn/ui
2. Supabase project setup (schema, RLS, auth)
3. Auth pages (login/signup)
4. Main app layout (sidebar + content area)
5. Task CRUD (create, read, update, delete, complete)
6. Task detail panel
7. Quick add bar with natural language parsing
8. Projects & sections CRUD
9. Labels CRUD
10. Inbox, Today, Upcoming views
11. Priority system
12. Subtasks
13. Recurring tasks (basic: daily/weekly/monthly/yearly)
14. **Persistent nagging reminders** (push notifications + service worker + edge function)
15. PWA setup (manifest, service worker, installable)
16. Dark mode
17. Responsive design (mobile-first)
18. Deploy to Vercel

### Phase 2: Power Features (Build Session 2)
19. Calendar view (month/week/day)
20. Kanban board view
21. Eisenhower Matrix view
22. Start dates
23. Task duration/estimates
24. Advanced recurring (RRULE builder, after-completion mode)
25. Custom filters / Smart Lists
26. Drag and drop reordering everywhere
27. Keyboard shortcuts
28. Bulk actions (multi-select tasks)

### Phase 3: Extras (Build Session 3)
29. Pomodoro timer
30. Habit tracker
31. Gamification (points, levels, streaks)
32. Statistics dashboard
33. Offline support (background sync)
34. Data export
35. Notification sound options
36. Onboarding flow (if going public)

---

## Design Principles

1. **Speed**: App must feel instant. Optimistic updates everywhere. No loading spinners for common actions.
2. **Keyboard-first**: Everything accessible via keyboard. Quick add with global shortcut.
3. **Information density**: Show more, chrome less. Todoist's density, not Google Tasks' emptiness.
4. **Color with purpose**: Priority colors, project colors, label colors all meaningful. Not decorative.
5. **Dark mode native**: Design dark-first, ensure light works too.
6. **Mobile ≠ dumbed down**: Same features, adapted layout. Not a stripped mobile version.

---

## Design Language

- **Font**: Inter (clean, great for UI)
- **Border radius**: 8px (slightly rounded, modern)
- **Spacing**: 4px grid system
- **Colors**: Indigo primary (#6366f1), with semantic colors for priorities
  - P4 Urgent: Red (#ef4444)
  - P3 High: Orange (#f97316)
  - P2 Medium: Yellow (#eab308)
  - P1 Low: Blue (#3b82f6)
  - P0 None: Gray (#6b7280)
- **Shadows**: Subtle, layered (sm for cards, md for modals, lg for popovers)
- **Animations**: Framer Motion for task completion, panel slides, page transitions. Keep them fast (150-200ms).

---

## API Structure

All data access via Supabase client (no custom API routes needed for CRUD):
```
supabase.from('tasks').select()
supabase.from('tasks').insert()
supabase.from('tasks').update()
supabase.from('tasks').delete()
```

Edge Functions (server-side):
- `send-nag-notifications`: Cron every 30s, queries overdue nag-enabled tasks, sends push
- `process-recurring`: Cron every hour, generates next occurrences for completed recurring tasks
- `cleanup-trash`: Cron daily, purges tasks deleted > 30 days ago

API Routes (Next.js, for push subscription management):
- `POST /api/push/subscribe` - Register push subscription
- `POST /api/push/unsubscribe` - Remove push subscription
- `POST /api/push/test` - Send test notification

---

## Key Technical Decisions

1. **RRULE for recurrence**: Industry standard (RFC 5545), libraries exist (`rrule.js`), compatible with iCal export later.
2. **JSONB for settings**: Flexible, no migration needed for new settings.
3. **Soft delete**: Tasks go to trash, auto-purge after 30 days. Users can restore.
4. **Optimistic updates**: TanStack Query mutations update cache immediately, rollback on error.
5. **Service worker for nags**: Even if app is closed, push notifications fire. Action buttons let you snooze/complete without opening the app.
6. **Edge Function cron for push**: Supabase pg_cron triggers the edge function. Reliable, server-side, free tier supports it.
7. **chrono-node for NLP**: Best JS date parser. Handles "next friday", "in 2 hours", "every other wednesday". We add custom regex on top for priority/project/label syntax.

---

## File Structure

```
todoer/
├── public/
│   ├── manifest.json
│   ├── sw.js (service worker)
│   ├── icons/ (PWA icons various sizes)
│   └── sounds/ (notification sounds)
├── src/
│   ├── app/
│   │   ├── layout.tsx (root layout, providers)
│   │   ├── page.tsx (redirect to /app/today)
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── app/
│   │       ├── layout.tsx (app shell: sidebar + main)
│   │       ├── inbox/page.tsx
│   │       ├── today/page.tsx
│   │       ├── upcoming/page.tsx
│   │       ├── calendar/page.tsx
│   │       ├── matrix/page.tsx
│   │       ├── project/[id]/page.tsx
│   │       ├── label/[id]/page.tsx
│   │       ├── habits/page.tsx
│   │       ├── focus/page.tsx
│   │       ├── stats/page.tsx
│   │       └── settings/page.tsx
│   ├── components/
│   │   ├── ui/ (shadcn components)
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── AppShell.tsx
│   │   │   └── MobileNav.tsx
│   │   ├── tasks/
│   │   │   ├── TaskList.tsx
│   │   │   ├── TaskItem.tsx
│   │   │   ├── TaskDetail.tsx
│   │   │   ├── QuickAdd.tsx
│   │   │   ├── TaskCheckbox.tsx
│   │   │   ├── PriorityPicker.tsx
│   │   │   ├── DatePicker.tsx
│   │   │   ├── LabelPicker.tsx
│   │   │   ├── ProjectPicker.tsx
│   │   │   ├── RecurrenceBuilder.tsx
│   │   │   └── SubtaskList.tsx
│   │   ├── projects/
│   │   │   ├── ProjectList.tsx
│   │   │   └── ProjectForm.tsx
│   │   ├── views/
│   │   │   ├── CalendarView.tsx
│   │   │   ├── KanbanBoard.tsx
│   │   │   └── EisenhowerMatrix.tsx
│   │   ├── habits/
│   │   │   ├── HabitList.tsx
│   │   │   ├── HabitItem.tsx
│   │   │   └── HabitHeatmap.tsx
│   │   ├── focus/
│   │   │   ├── PomodoroTimer.tsx
│   │   │   └── FocusStats.tsx
│   │   └── stats/
│   │       ├── StatsOverview.tsx
│   │       └── Charts.tsx
│   ├── hooks/
│   │   ├── useTasks.ts (TanStack Query hooks for tasks)
│   │   ├── useProjects.ts
│   │   ├── useLabels.ts
│   │   ├── useHabits.ts
│   │   ├── usePomodoro.ts
│   │   ├── useNotifications.ts
│   │   └── useNLP.ts (natural language parsing)
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts (browser client)
│   │   │   ├── server.ts (server client)
│   │   │   └── middleware.ts (auth middleware)
│   │   ├── nlp.ts (natural language task parser)
│   │   ├── rrule.ts (recurrence helpers)
│   │   ├── push.ts (push notification helpers)
│   │   ├── gamification.ts (points/levels logic)
│   │   └── utils.ts
│   ├── stores/
│   │   ├── ui-store.ts (sidebar state, modals, theme)
│   │   └── timer-store.ts (pomodoro state)
│   └── types/
│       ├── database.ts (generated Supabase types)
│       └── index.ts (app-level types)
├── supabase/
│   ├── migrations/ (SQL migration files)
│   └── functions/
│       ├── send-nag-notifications/index.ts
│       ├── process-recurring/index.ts
│       └── cleanup-trash/index.ts
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── SPEC.md (this file)
```

---

## Success Criteria for Phase 1

The app is "done" for Phase 1 when:
- [ ] I can sign up and log in
- [ ] I can create a task with natural language ("Buy groceries tomorrow at 5pm p2 #personal")
- [ ] I can see tasks in Inbox, Today, and Upcoming views
- [ ] I can create projects with sections
- [ ] I can create and assign labels
- [ ] I can set a task to nag me and actually receive push notifications every minute
- [ ] I can snooze or complete a task from the notification itself
- [ ] I can create recurring tasks
- [ ] I can add subtasks
- [ ] I can set priorities with visual color coding
- [ ] The app works on mobile (responsive)
- [ ] The app is installable as PWA
- [ ] Dark mode works
- [ ] The app is deployed and accessible via URL
