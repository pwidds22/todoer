import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlannedReminder } from '@/lib/reminders/planner'

interface NativeNotification { id: number; title?: string; sound?: string; extra?: Record<string, unknown>; schedule?: { at: Date; repeats?: boolean } }
const device = vi.hoisted(() => ({
  permission: 'granted',
  platform: 'android',
  pending: [] as NativeNotification[],
  delivered: [] as NativeNotification[],
  scheduleWait: null as Promise<void> | null,
  permissionWait: null as Promise<void> | null,
  cancelError: null as Error | null,
}))
vi.mock('@/lib/native/platform', () => ({ isNative: () => true }))
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => device.platform } }))
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: {
  checkPermissions: async () => ({ display: device.permission }),
  requestPermissions: async () => { if (device.permissionWait) await device.permissionWait; return { display: device.permission } },
  createChannel: async () => {},
  getPending: async () => ({ notifications: [...device.pending] }),
  getDeliveredNotifications: async () => ({ notifications: [...device.delivered] }),
  cancel: async ({ notifications }: { notifications: Array<{ id: number }> }) => {
    if (device.cancelError) throw device.cancelError
    device.pending = device.pending.filter(n => !notifications.some(c => c.id === n.id))
  },
  removeDeliveredNotifications: async ({ notifications }: { notifications: Array<{ id: number }> }) => {
    device.delivered = device.delivered.filter(n => !notifications.some(c => c.id === n.id))
  },
  schedule: async ({ notifications }: { notifications: NativeNotification[] }) => {
    if (device.scheduleWait) await device.scheduleWait
    device.pending.push(...notifications)
  },
  checkExactNotificationSetting: async () => ({ exact_alarm: 'granted' }),
} }))

import { activateReminderAccount, cancelTaskNativeReminders, clearNativeReminders, scheduleReminderProbe, stopReminderAccount, syncNativeReminders } from '@/lib/reminders/native'

const now = new Date('2026-09-12T10:00:00').getTime()
const once: PlannedReminder = { id: 11, taskId: 'task-a', title: 'Dentist', at: now + 60_000, revision: 'once-a', oneShot: true }
const build = (consumed: ReadonlySet<number>) => consumed.has(once.id) ? [] : [once]

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  })
  vi.stubGlobal('window', new EventTarget())
  device.permission = 'granted'
  device.platform = 'android'
  device.pending = []
  device.delivered = []
  device.scheduleWait = null
  device.permissionWait = null
  device.cancelError = null
  activateReminderAccount('owner')
})

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('native and foreground one-shot ownership', () => {
  it.each([
    { platform: 'ios', offsets: [60_000, 120_000, 180_000] },
    { platform: 'android', offsets: [60_000, 660_000, 1_260_000] },
  ])('schedules and cancels the finite $platform device probe', async ({ platform, offsets }) => {
    device.platform = platform
    await scheduleReminderProbe()
    expect(device.pending.map(n => n.schedule!.at.getTime() - now)).toEqual(offsets)
    expect(device.pending.every(n => n.schedule?.repeats !== true)).toBe(true)
    expect(device.pending.every(n => n.sound === (platform === 'ios' ? 'default' : undefined))).toBe(true)
    await syncNativeReminders('owner', () => [])
    expect(device.pending).toHaveLength(3)
    await cancelTaskNativeReminders('device-probe')
    expect(device.pending).toEqual([])
  })

  it('does not schedule an iPhone probe when permission is denied', async () => {
    device.platform = 'ios'
    device.permission = 'denied'
    await scheduleReminderProbe()
    expect(device.pending).toEqual([])
  })

  it('keeps probe cancellation last while the permission prompt is pending', async () => {
    device.platform = 'ios'
    let release!: () => void
    device.permissionWait = new Promise<void>(resolve => { release = resolve })
    const probe = scheduleReminderProbe()
    await vi.advanceTimersByTimeAsync(0)
    const cancel = cancelTaskNativeReminders('device-probe')
    release()
    await Promise.all([probe, cancel])
    expect(device.pending).toEqual([])
  })

  it.each([
    { platform: 'ios', sound: 'default' },
    { platform: 'android', sound: undefined },
  ])('uses standard iOS sound and preserves the Android channel policy: $platform', async ({ platform, sound }) => {
    device.platform = platform
    await syncNativeReminders('owner', build)
    expect(device.pending).toHaveLength(1)
    expect(device.pending[0].sound).toBe(sound)
  })

  it('reports ownership for pending and previously issued one-shots after reopening', async () => {
    const first = await syncNativeReminders('owner', build)
    expect(first.ownedOneShotIds).toContain(once.id)
    expect(device.pending.map(n => n.id)).toEqual([11])
    vi.setSystemTime(now + 120_000)
    device.delivered = device.pending
    device.pending = []
    const reopened = await syncNativeReminders('owner', build)
    expect(reopened.ownedOneShotIds).toContain(once.id)
    expect(device.pending).toEqual([])
  })

  it('does not take ownership when permission is off, or schedule a foreground-consumed one-shot after permission returns', async () => {
    device.permission = 'denied'
    const blocked = await syncNativeReminders('owner', build)
    expect(blocked.ownedOneShotIds).toEqual([])
    expect(device.pending).toEqual([])
    localStorage.setItem('todoer-foreground-receipts:owner', JSON.stringify({ receipts: { '11': now }, onceIds: { '11': true } }))
    device.permission = 'granted'
    await syncNativeReminders('owner', build)
    expect(device.pending).toEqual([])
  })

  it('releases pending native ownership when permission is revoked before delivery', async () => {
    await syncNativeReminders('owner', build)
    device.permission = 'denied'
    vi.setSystemTime(now + 30_000)
    const blocked = await syncNativeReminders('owner', build)
    expect(blocked.ownedOneShotIds).toEqual([])
    expect(device.pending).toEqual([])
    vi.setSystemTime(now + 120_000)
    const due = await syncNativeReminders('owner', build)
    expect(due.ownedOneShotIds).toEqual([])
  })

  it('does not let another account use the previous account\'s foreground receipts', async () => {
    localStorage.setItem('todoer-foreground-receipts:other', JSON.stringify({ receipts: { '11': now }, onceIds: { '11': true } }))
    await syncNativeReminders('owner', build)
    expect(device.pending.map(n => n.id)).toEqual([11])
  })

  it('releases canceled pending one-shots for the account that signed out before their due time', async () => {
    await syncNativeReminders('owner', build)
    const otherReceipts = JSON.stringify({ issued: { '11': now + 60_000 }, onceIds: { '11': true } })
    localStorage.setItem('todoer-issued-v2:other', otherReceipts)
    stopReminderAccount()
    await clearNativeReminders('owner')
    expect(localStorage.getItem('todoer-issued-v2:other')).toBe(otherReceipts)
    vi.setSystemTime(now + 120_000)
    activateReminderAccount('owner')
    await syncNativeReminders('owner', build)
    expect(device.pending.map(n => n.id)).toEqual([11])
  })

  it('preserves delivered one-shot receipts when clearing device notifications at sign-out', async () => {
    await syncNativeReminders('owner', build)
    vi.setSystemTime(now + 120_000)
    device.delivered = device.pending
    device.pending = []
    stopReminderAccount()
    await clearNativeReminders('owner')
    activateReminderAccount('owner')
    const resumed = await syncNativeReminders('owner', build)
    expect(device.pending).toEqual([])
    expect(resumed.ownedOneShotIds).toContain(11)
  })

  it('allows a canceled pending one-shot after a failed task write restores the overdue task', async () => {
    await syncNativeReminders('owner', build)
    await cancelTaskNativeReminders('task-a')
    vi.setSystemTime(now + 120_000)
    await syncNativeReminders('owner', build)
    expect(device.pending.map(n => n.id)).toEqual([11])
  })

  it('releases future ownership when permission revocation already removed OS pending entries', async () => {
    await syncNativeReminders('owner', build)
    device.pending = []
    device.permission = 'denied'
    vi.setSystemTime(now + 30_000)
    await syncNativeReminders('owner', build)
    vi.setSystemTime(now + 120_000)
    const later = await syncNativeReminders('owner', build)
    expect(later.ownedOneShotIds).toEqual([])
  })

  it('keeps pending ownership when cancellation fails', async () => {
    await syncNativeReminders('owner', build)
    device.cancelError = new Error('Device cancellation failed')
    stopReminderAccount()
    await expect(clearNativeReminders('owner')).rejects.toThrow('Device cancellation failed')
    device.cancelError = null
    activateReminderAccount('owner')
    const resumed = await syncNativeReminders('owner', build)
    expect(device.pending.map(n => n.id)).toEqual([11])
    expect(resumed.ownedOneShotIds).toContain(11)
  })

  it('keeps cancellation last when sign-out happens during native scheduling', async () => {
    let release!: () => void
    device.scheduleWait = new Promise<void>(resolve => { release = resolve })
    const active = syncNativeReminders('owner', build)
    await vi.advanceTimersByTimeAsync(0)
    stopReminderAccount()
    const clear = clearNativeReminders('owner')
    const stale = syncNativeReminders('owner', build)
    release()
    await Promise.all([active, clear, stale])
    expect(device.pending).toEqual([])
  })
})
