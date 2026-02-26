import * as chrono from 'chrono-node'

export interface ParsedTask {
  title: string
  dueDate: string | null // YYYY-MM-DD
  dueTime: string | null // HH:MM
  priority: number // 0-4
  projectName: string | null
  labelNames: string[]
  recurrence: string | null
}

export function parseTaskInput(input: string): ParsedTask {
  let text = input.trim()
  let priority = 0
  const labelNames: string[] = []
  let projectName: string | null = null

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

  for (const pattern of recurrencePatterns) {
    const match = text.match(pattern.regex)
    if (match) {
      recurrence = pattern.rule.replace('$1', match[1] || '')
      text = text.replace(match[0], '').trim()
      break
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

  const parsed = chrono.parse(text, new Date(), { forwardDate: true })
  if (parsed.length > 0) {
    const result = parsed[0]
    const date = result.start.date()

    dueDate = date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0')

    if (result.start.isCertain('hour')) {
      dueTime = String(date.getHours()).padStart(2, '0') + ':' +
        String(date.getMinutes()).padStart(2, '0')
    }

    // Remove the date text from the title
    text = text.slice(0, result.index) + text.slice(result.index + result.text.length)
    text = text.replace(/\s+/g, ' ').trim()
  }

  // If monthly recurrence has BYMONTHDAY but no date was parsed by chrono,
  // compute the due date as that day of the current or next month.
  if (recurrence && !dueDate) {
    const byMonthDayMatch = recurrence.match(/BYMONTHDAY=(\d{1,2})/)
    if (byMonthDayMatch) {
      const targetDay = parseInt(byMonthDayMatch[1], 10)
      const now = new Date()
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
  }
}
