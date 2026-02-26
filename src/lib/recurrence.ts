/**
 * Recurrence utility for calculating next occurrence dates from RRULE strings.
 *
 * Supported RRULE patterns (matching the NLP parser in nlp.ts):
 *   FREQ=DAILY
 *   FREQ=DAILY;INTERVAL=N
 *   FREQ=WEEKLY
 *   FREQ=WEEKLY;BYDAY=MO (or TU, WE, TH, FR, SA, SU)
 *   FREQ=WEEKLY;INTERVAL=N
 *   FREQ=MONTHLY
 *   FREQ=MONTHLY;INTERVAL=N
 *   FREQ=YEARLY
 *   FREQ=YEARLY;INTERVAL=N
 */

const DAY_NAMES: Record<string, string> = {
  SU: 'Sunday',
  MO: 'Monday',
  TU: 'Tuesday',
  WE: 'Wednesday',
  TH: 'Thursday',
  FR: 'Friday',
  SA: 'Saturday',
}

const DAY_MAP: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
}

interface RRuleParts {
  freq: string
  interval: number
  byDay: string | null
}

/**
 * Parse an RRULE string into its constituent parts.
 *
 * Examples:
 *   "FREQ=DAILY"               -> { freq: "DAILY", interval: 1, byDay: null }
 *   "FREQ=WEEKLY;BYDAY=MO"    -> { freq: "WEEKLY", interval: 1, byDay: "MO" }
 *   "FREQ=MONTHLY;INTERVAL=2" -> { freq: "MONTHLY", interval: 2, byDay: null }
 */
export function parseRRule(rule: string): RRuleParts {
  const parts: Record<string, string> = {}
  for (const segment of rule.split(';')) {
    const [key, value] = segment.split('=')
    if (key && value) {
      parts[key.trim()] = value.trim()
    }
  }

  return {
    freq: parts.FREQ || 'DAILY',
    interval: parts.INTERVAL ? parseInt(parts.INTERVAL, 10) : 1,
    byDay: parts.BYDAY || null,
  }
}

/**
 * Calculate the next occurrence date from a recurrence rule.
 *
 * @param recurrenceRule - An RRULE string (e.g., "FREQ=WEEKLY;BYDAY=MO")
 * @param currentDueDate - The current due date as a "YYYY-MM-DD" string
 * @returns The next occurrence date as a "YYYY-MM-DD" string
 */
export function getNextOccurrence(
  recurrenceRule: string,
  currentDueDate: string
): string {
  const { freq, interval, byDay } = parseRRule(recurrenceRule)

  // Parse the current due date into year/month/day components to avoid
  // timezone issues. We work entirely in date-only (no time) space.
  const [year, month, day] = currentDueDate.split('-').map(Number)
  const date = new Date(year, month - 1, day)

  switch (freq) {
    case 'DAILY': {
      date.setDate(date.getDate() + interval)
      break
    }

    case 'WEEKLY': {
      if (byDay && DAY_MAP[byDay] !== undefined) {
        // Advance to the next occurrence of the specified day of week.
        // If the current date is already that day, jump ahead by the
        // interval number of weeks.
        const targetDay = DAY_MAP[byDay]
        const currentDay = date.getDay()
        let daysUntilTarget = targetDay - currentDay
        if (daysUntilTarget <= 0) {
          // Target day is today or already passed this week.
          // Jump to the target day in the next interval-th week.
          daysUntilTarget += 7 * interval
        } else if (interval > 1) {
          // Target day is later this week but interval > 1 means we
          // should skip ahead by (interval - 1) additional weeks.
          daysUntilTarget += 7 * (interval - 1)
        }
        date.setDate(date.getDate() + daysUntilTarget)
      } else {
        // No specific day -- just advance by interval weeks.
        date.setDate(date.getDate() + 7 * interval)
      }
      break
    }

    case 'MONTHLY': {
      // Advance by interval months, clamping to the last day of the
      // target month if the original day exceeds it (e.g., Jan 31 + 1
      // month = Feb 28/29).
      const originalDay = date.getDate()
      date.setMonth(date.getMonth() + interval, 1)
      const daysInTargetMonth = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        0
      ).getDate()
      date.setDate(Math.min(originalDay, daysInTargetMonth))
      break
    }

    case 'YEARLY': {
      // Advance by interval years, clamping for leap year edge cases
      // (e.g., Feb 29 in a leap year -> Feb 28 in a non-leap year).
      const origDay = date.getDate()
      const origMonth = date.getMonth()
      date.setFullYear(date.getFullYear() + interval)
      // Restore month in case year change shifted it (shouldn't normally)
      date.setMonth(origMonth, 1)
      const daysInMonth = new Date(
        date.getFullYear(),
        origMonth + 1,
        0
      ).getDate()
      date.setDate(Math.min(origDay, daysInMonth))
      break
    }

    default: {
      // Unknown frequency -- fall back to daily.
      date.setDate(date.getDate() + interval)
      break
    }
  }

  return formatDate(date)
}

/**
 * Format a Date object as "YYYY-MM-DD".
 */
function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Calculate the next due date for a recurring task based on recurrence type.
 *
 * - "fixed" recurrence: the next date is calculated from the original due date,
 *   so the cadence stays anchored to the original schedule regardless of when
 *   the task was actually completed.
 *
 * - "floating" recurrence: the next date is calculated from today, so if the
 *   user completes a weekly task 3 days late, the next occurrence is a full
 *   week from now rather than from the original due date.
 *
 * @param recurrenceRule - The RRULE string
 * @param currentDueDate - The current due date as "YYYY-MM-DD"
 * @param recurrenceType - "fixed" or "floating" (defaults to "fixed")
 * @returns The next due date as "YYYY-MM-DD"
 */
export function calculateNextDueDate(
  recurrenceRule: string,
  currentDueDate: string | null,
  recurrenceType: string | null
): string {
  const type = recurrenceType || 'fixed'
  const today = formatDate(new Date())

  if (type === 'floating' || !currentDueDate) {
    // Floating: calculate from today.
    return getNextOccurrence(recurrenceRule, today)
  }

  // Fixed: calculate from the original due date. If the computed next
  // date is in the past (because the task was overdue), keep advancing
  // until we land on a future date.
  let nextDate = getNextOccurrence(recurrenceRule, currentDueDate)
  while (nextDate <= today) {
    nextDate = getNextOccurrence(recurrenceRule, nextDate)
  }

  return nextDate
}

/**
 * Build an RRULE string from constituent parts.
 */
export function buildRRule(parts: {
  freq: string
  interval?: number
  byDay?: string | null
}): string {
  let rule = `FREQ=${parts.freq}`
  if (parts.interval && parts.interval > 1) {
    rule += `;INTERVAL=${parts.interval}`
  }
  if (parts.byDay) {
    rule += `;BYDAY=${parts.byDay}`
  }
  return rule
}

/**
 * Convert an RRULE string to a human-readable description.
 *
 * Examples:
 *   "FREQ=DAILY"                -> "Every day"
 *   "FREQ=DAILY;INTERVAL=3"    -> "Every 3 days"
 *   "FREQ=WEEKLY"              -> "Every week"
 *   "FREQ=WEEKLY;BYDAY=MO"    -> "Every Monday"
 *   "FREQ=WEEKLY;INTERVAL=2"   -> "Every 2 weeks"
 *   "FREQ=WEEKLY;INTERVAL=2;BYDAY=FR" -> "Every 2 weeks on Friday"
 *   "FREQ=MONTHLY"             -> "Every month"
 *   "FREQ=MONTHLY;INTERVAL=3"  -> "Every 3 months"
 *   "FREQ=YEARLY"              -> "Every year"
 */
export function describeRRule(rule: string | null | undefined): string {
  if (!rule) return ''
  const { freq, interval, byDay } = parseRRule(rule)

  // Handle multi-day BYDAY (e.g., "MO,TU,WE,TH,FR")
  let dayDesc: string | null = null
  if (byDay) {
    const dayKeys = byDay.split(',').map((d) => d.trim())
    // Check for weekdays shorthand
    const weekdays = ['MO', 'TU', 'WE', 'TH', 'FR']
    if (
      dayKeys.length === 5 &&
      weekdays.every((d) => dayKeys.includes(d))
    ) {
      dayDesc = 'weekday'
    } else if (dayKeys.length === 1) {
      dayDesc = DAY_NAMES[dayKeys[0]] || dayKeys[0]
    } else {
      dayDesc = dayKeys.map((d) => DAY_NAMES[d] || d).join(', ')
    }
  }

  switch (freq) {
    case 'DAILY':
      if (interval === 1) return 'Every day'
      return `Every ${interval} days`

    case 'WEEKLY':
      if (dayDesc === 'weekday') {
        return interval === 1 ? 'Every weekday' : `Every ${interval} weeks on weekdays`
      }
      if (interval === 1) {
        return dayDesc ? `Every ${dayDesc}` : 'Every week'
      }
      const base = `Every ${interval} weeks`
      return dayDesc ? `${base} on ${dayDesc}` : base

    case 'MONTHLY':
      if (interval === 1) return 'Every month'
      return `Every ${interval} months`

    case 'YEARLY':
      if (interval === 1) return 'Every year'
      return `Every ${interval} years`

    default:
      return rule
  }
}
