export const REMINDER_QUEUE_LIMIT = 32
export const REMINDER_HORIZON_MS = 24 * 60 * 60 * 1000

type ReminderPlatform = 'ios' | 'android' | 'web'

function makePolicy(platform: ReminderPlatform) {
  const native = platform !== 'web'
  const minimumIntervalSeconds = platform === 'android' ? 600 : 60
  const minutes = minimumIntervalSeconds / 60
  const interval = `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
  const probeOffsetsMinutes = platform === 'ios' ? [1, 2, 3] : platform === 'android' ? [1, 11, 21] : []
  const probeTimes = probeOffsetsMinutes.length ? `${probeOffsetsMinutes[0]}, ${probeOffsetsMinutes[1]} and ${probeOffsetsMinutes[2]} minutes` : ''
  const backgroundSummary = native
    ? `Background Inbox reminders request intervals of at least ${interval}. Up to ${REMINDER_QUEUE_LIMIT} alerts are queued within ${REMINDER_HORIZON_MS / 3_600_000} hours. They stop when the queue ends; reopen Todoer to refresh it.`
    : 'Browser reminders need Todoer open.'
  const deliveryCaveat = platform === 'ios'
    ? 'Standard notification sound is requested. iPhone Silent mode, Focus, Scheduled Summary and notification settings can delay or silence alerts.'
    : platform === 'android'
      ? 'Android idle limits apply across the whole app, so multiple tasks, battery restrictions or force-stop can delay or block alerts.'
      : 'A browser may pause reminders when the tab is inactive.'
  const probeDescription = native
    ? `Requests three alerts in ${probeTimes}, independent of your tasks and quiet hours. Lock your phone after starting. ${deliveryCaveat}`
    : 'The background reminder test requires the installed phone app.'
  return {
    platform,
    planning: { minimumIntervalSeconds, limit: REMINDER_QUEUE_LIMIT, horizonMs: REMINDER_HORIZON_MS },
    probeOffsetsMinutes,
    backgroundSummary,
    deliveryCaveat,
    initialStatus: native ? `Enable device notifications to schedule Inbox reminders. ${backgroundSummary}` : 'Open-app reminders only in this browser.',
    controlsDescription: `Personal to this device. While open, reminders follow your interval. ${backgroundSummary} ${deliveryCaveat} List reminders need Todoer open and connected. Device status and quiet hours are in Settings.`,
    probeDescription,
    probeScheduledStatus: `Three test alerts requested: in ${probeTimes}. Lock the phone to test background delivery. Cancel test to stop them. ${deliveryCaveat}`,
  }
}

const policies = { ios: makePolicy('ios'), android: makePolicy('android'), web: makePolicy('web') }

export function getReminderPolicy(platform: string) {
  return policies[platform === 'ios' || platform === 'android' ? platform : 'web']
}

export function getNativeReminderStatus(platform: string, slots: number, exactAlarms = true): string {
  const policy = getReminderPolicy(platform)
  const exactStatus = policy.platform === 'android' && !exactAlarms ? 'Exact alarms are off; delivery may be late. ' : ''
  return `${slots} reminder slots planned for Inbox tasks. ${exactStatus}${policy.backgroundSummary} ${policy.deliveryCaveat}`
}
