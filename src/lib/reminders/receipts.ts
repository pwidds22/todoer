export interface ReminderReceipts { issued: Record<string, number>; onceIds: Record<string, boolean> }
export function readReminderReceipts(raw: string | null): ReminderReceipts {
  const result: ReminderReceipts = { issued: {}, onceIds: {} }
  try {
    const value: unknown = JSON.parse(raw || '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return result
    const object = value as Record<string, unknown>
    const issued = object.issued ?? object.receipts
    if (issued && typeof issued === 'object' && !Array.isArray(issued)) {
      for (const [key, at] of Object.entries(issued)) if (/^\d+$/.test(key) && typeof at === 'number' && Number.isFinite(at) && at > 0) result.issued[key] = at
    }
    const once = object.onceIds
    if (once && typeof once === 'object' && !Array.isArray(once)) {
      for (const [key, enabled] of Object.entries(once)) if (/^\d+$/.test(key) && enabled === true) result.onceIds[key] = true
    }
  } catch { /* Corrupt local storage must not stop all future reminders. */ }
  return result
}
