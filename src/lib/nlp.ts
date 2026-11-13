import * as chrono from 'chrono-node'

export interface ParsedTask {
  title: string
  dueDate: string | null // YYYY-MM-DD
  dueTime: string | null // HH:MM
  priority: number // 0-4
  projectName: string | null
  labelNames: string[]
  recurrence: string | null
  reminderMode: 'off' | 'once' | 'persistent'
  reminderIntervalSeconds: number | null
  ambiguousTime: { text: string; am: string; pm: string } | null
  warnings: string[]
  requiresReview: boolean
}

export function parseTaskInput(input: string, referenceDate = new Date()): ParsedTask {
  let text = input.trim()
  let priority = 0
  const labelNames: string[] = []
  let projectName: string | null = null
  const warnings: string[] = []
  let requiresReview = false
  let reminderMode: ParsedTask['reminderMode'] = 'off'
  let reminderIntervalSeconds: number | null = null

  // Parse reminder intent before recurrence/date extraction so "every minute"
  // cannot become a recurring task or an unrelated relative due date.
  const negatedReminder = /\b(?:do\s+not|don['’]t|never)\s+(?:remind|nag)\s+me\b/i.test(text)
  const repeatedReminder = /\b(?:and\s+)?(?:remind|nag)\s+me\s+every\s+(?:(\d+(?:\.\d+)?|[a-z]+)\s+)?(minutes?|mins?|hours?|hrs?|days?|seconds?)\b(?:\s+until\s+(?:it(?:['’]s|\s+is)?\s+)?(?:done|complete(?:d)?))?[.!]?/i
  const repeatMatch = text.match(repeatedReminder)
  if (negatedReminder) {
    warnings.push('Reminders are off because the reminder wording includes a negation. Review the title and reminder choice.')
    requiresReview = true
    // Keep the original wording available for review, without interpreting a
    // reminder interval as a task recurrence or due date.
    if (repeatMatch) text = text.replace(repeatMatch[0], '')
  } else if (repeatMatch) {
    reminderMode = 'persistent'
    const words: Record<string, number> = { one: 1, two: 2, five: 5, ten: 10, fifteen: 15, thirty: 30, sixty: 60 }
    const amount = repeatMatch[1] ? (words[repeatMatch[1].toLowerCase()] ?? Number(repeatMatch[1])) : 1
    const unit = repeatMatch[2].toLowerCase()
    const seconds = amount * (/^h/.test(unit) ? 3600 : /^m/.test(unit) ? 60 : /^d/.test(unit) ? 86400 : 1)
    if ([60, 120, 300, 600, 900, 1800, 3600].includes(seconds)) {
      reminderIntervalSeconds = seconds
    } else {
      warnings.push('That reminder interval is not supported. Choose an interval below, or turn reminders off.')
    }
    text = text.replace(repeatMatch[0], '').trim()
  } else {
    const untilDone = /\b(?:and\s+)?(?:remind|nag)\s+me\s+until\s+(?:it(?:['’]s|\s+is)?\s+)?(?:done|complete(?:d)?)\b[.!]?/i
    if (untilDone.test(text)) {
      reminderMode = 'persistent'
      warnings.push('Choose how often to remind you until this task is done.')
      text = text.replace(untilDone, '').trim()
    } else if (/\b(?:remind|nag)\s+me\s+every\b/i.test(text)) {
      warnings.push('The reminder wording was not understood. Reminders are off; choose a reminder and interval below if you want one.')
      requiresReview = true
    } else if (/\bremind\s+me\b/i.test(text)) {
      reminderMode = 'once'
      text = text.replace(/\b(?:and\s+)?remind\s+me(?:\s+to)?\b/i, '').trim()
    }
  }

  // Multi-task capture is intentionally bounded: common second action clauses
  // and separators ask the person to review the single task being created.
  if (/[;\n]/.test(text) || /\b(?:and|then)\s+(?:call|buy|email|send|book|pay|pick|take|clean|schedule|finish|write|walk|read|make|do|check)\b/i.test(text)) {
    warnings.push('This may contain more than one task. Only one task will be saved; edit the title or add tasks separately.')
    requiresReview = true
  }

  // Extract priority: p1, p2, p3, p4, !, !!, !!!, !!!!
  const priorityMatch = text.match(/\bp([1-4])\b/i)
  if (priorityMatch) {
    priority = parseInt(priorityMatch[1])
    text = text.replace(priorityMatch[0], '').trim()
  } else {
    const bangMatch = text.match(/(!{1,4})(?:\s|$)/)
    if (bangMatch) {
      priority = Math.min(bangMatch[1].length, 4)
      text = text.replace(bangMatch[0], '').trim()
    }
  }

  // Extract labels: @labelname
  const labelRegex = /@(\w[\w-]*)/g
  let labelMatch
  while ((labelMatch = labelRegex.exec(text)) !== null) {
    labelNames.push(labelMatch[1])
  }
  text = text.replace(/@\w[\w-]*/g, '').trim()

  // Extract project: #projectname
  const projectMatch = text.match(/#(\w[\w-]*)/)
  if (projectMatch) {
    projectName = projectMatch[1]
    text = text.replace(/#\w[\w-]*/, '').trim()
  }

  // Extract recurrence patterns before date parsing
  let recurrence: string | null = null
  const recurrencePatterns = [
    { regex: /\bevery\s+day\b/i, rule: 'FREQ=DAILY' },
    { regex: /\bdaily\b/i, rule: 'FREQ=DAILY' },
    { regex: /\bevery\s+week\b/i, rule: 'FREQ=WEEKLY' },
    { regex: /\bweekly\b/i, rule: 'FREQ=WEEKLY' },
    { regex: /\bevery\s+month\b/i, rule: 'FREQ=MONTHLY' },
    { regex: /\bmonthly\b/i, rule: 'FREQ=MONTHLY' },
    { regex: /\bevery\s+year\b/i, rule: 'FREQ=YEARLY' },
    { regex: /\byearly\b/i, rule: 'FREQ=YEARLY' },
    { regex: /\bevery\s+(monday|mon)\b/i, rule: 'FREQ=WEEKLY;BYDAY=MO' },
    { regex: /\bevery\s+(tuesday|tue)\b/i, rule: 'FREQ=WEEKLY;BYDAY=TU' },
    { regex: /\bevery\s+(wednesday|wed)\b/i, rule: 'FREQ=WEEKLY;BYDAY=WE' },
    { regex: /\bevery\s+(thursday|thu)\b/i, rule: 'FREQ=WEEKLY;BYDAY=TH' },
    { regex: /\bevery\s+(friday|fri)\b/i, rule: 'FREQ=WEEKLY;BYDAY=FR' },
    { regex: /\bevery\s+(saturday|sat)\b/i, rule: 'FREQ=WEEKLY;BYDAY=SA' },
    { regex: /\bevery\s+(sunday|sun)\b/i, rule: 'FREQ=WEEKLY;BYDAY=SU' },
    { regex: /\bevery\s+(\d+)\s+days?\b/i, rule: 'FREQ=DAILY;INTERVAL=$1' },
    { regex: /\bevery\s+(\d+)\s+weeks?\b/i, rule: 'FREQ=WEEKLY;INTERVAL=$1' },
    { regex: /\bevery\s+(\d+)\s+months?\b/i, rule: 'FREQ=MONTHLY;INTERVAL=$1' },
  ]

  const recurrenceMatches = recurrencePatterns.reduce((count, pattern) =>
    count + [...text.matchAll(new RegExp(pattern.regex.source, 'gi'))].length, 0)
  const recurrenceNeedsReview = recurrenceMatches > 1 || (recurrenceMatches > 0 &&
    /(?:\band\b|\bor\b|,)\s+(?:every\s+)?(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i.test(text))

  if (recurrenceNeedsReview) {
    warnings.push('There is more than one repeat day or pattern. Choose the full schedule under Repeat and review the due date.')
    requiresReview = true
  } else {
    for (const pattern of recurrencePatterns) {
      const match = text.match(pattern.regex)
      if (match) {
        recurrence = pattern.rule.replace('$1', match[1] || '')
        text = text.replace(match[0], '').trim()
        break
      }
    }
  }

  // Extract "on the Nth" day-of-month for monthly recurrence
  // Supports: "on the 1st", "on the 2nd", "on the 3rd", "on the 15th", "on the 31st"
  // Also bare numbers: "on the 1", "on the 15"
  if (recurrence && recurrence.startsWith('FREQ=MONTHLY')) {
    const onTheNthRegex = /\bon\s+the\s+(\d{1,2})(?:st|nd|rd|th)?\b/i
    const onTheNthMatch = text.match(onTheNthRegex)
    if (onTheNthMatch) {
      const monthDay = parseInt(onTheNthMatch[1], 10)
      if (monthDay >= 1 && monthDay <= 31) {
        recurrence += `;BYMONTHDAY=${monthDay}`
        text = text.replace(onTheNthMatch[0], '').trim()
      }
    }
  }

  // Parse dates with chrono
  let dueDate: string | null = null
  let dueTime: string | null = null
  let ambiguousTime: ParsedTask['ambiguousTime'] = null

  const parsed = recurrenceNeedsReview ? [] : chrono.parse(text, referenceDate, { forwardDate: true })
  const ambiguousDates = parsed.length > 1 || parsed.some(result => result.end)
  if (ambiguousDates) {
    warnings.push(parsed.length > 1
      ? 'I found multiple dates. Choose one due date and time below, or leave them empty. Only one task will be saved.'
      : 'I found a date or time range. Choose one due date and time below, or leave them empty; task ranges are not supported.')
    requiresReview = true
  } else if (parsed.length === 1) {
    const result = parsed[0]
    const date = result.start.date()

    dueDate = date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0')

    if (result.start.isCertain('hour')) {
      const hour = date.getHours()
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const needsMeridiem = !result.start.isCertain('meridiem') && hour >= 1 && hour <= 12 &&
        !/\b(?:noon|midnight|in|within|after|ago|later)\b/i.test(result.text)
      if (needsMeridiem) {
        ambiguousTime = {
          text: result.text,
          am: String(hour % 12).padStart(2, '0') + ':' + minutes,
          pm: String(hour % 12 + 12).padStart(2, '0') + ':' + minutes,
        }
        // A date inferred from an assumed AM time could change when PM is
        // selected. Require an explicit date instead of carrying that guess.
        if (!result.start.isCertain('day') && !result.start.isCertain('weekday')) dueDate = null
      } else {
        dueTime = String(hour).padStart(2, '0') + ':' + minutes
      }
    }

    // Remove the date text from the title
    text = text.slice(0, result.index) + text.slice(result.index + result.text.length)
    text = text.replace(/\s+/g, ' ').trim()
  }

  // If monthly recurrence has BYMONTHDAY but no date was parsed by chrono,
  // compute the due date as that day of the current or next month.
  if (recurrence && !dueDate && !ambiguousDates) {
    const byMonthDayMatch = recurrence.match(/BYMONTHDAY=(\d{1,2})/)
    if (byMonthDayMatch) {
      const targetDay = parseInt(byMonthDayMatch[1], 10)
      const now = referenceDate
      let year = now.getFullYear()
      let month = now.getMonth() // 0-indexed

      // Determine if the target day this month is still in the future
      const daysInCurrentMonth = new Date(year, month + 1, 0).getDate()
      const clampedDayCurrent = Math.min(targetDay, daysInCurrentMonth)

      if (clampedDayCurrent > now.getDate()) {
        // Target day is later this month
        dueDate = year + '-' +
          String(month + 1).padStart(2, '0') + '-' +
          String(clampedDayCurrent).padStart(2, '0')
      } else {
        // Target day has passed this month (or is today), use next month
        month += 1
        if (month > 11) {
          month = 0
          year += 1
        }
        const daysInNextMonth = new Date(year, month + 1, 0).getDate()
        const clampedDayNext = Math.min(targetDay, daysInNextMonth)
        dueDate = year + '-' +
          String(month + 1).padStart(2, '0') + '-' +
          String(clampedDayNext).padStart(2, '0')
      }
    }
  }

  // Clean up remaining whitespace
  const title = text.replace(/\s+/g, ' ').trim()

  return {
    title: title || input.trim(),
    dueDate,
    dueTime,
    priority,
    projectName,
    labelNames,
    recurrence,
    reminderMode,
    reminderIntervalSeconds,
    ambiguousTime,
    warnings,
    requiresReview,
  }
}
