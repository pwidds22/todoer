import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

function worker() {
  const handlers: Record<string, (event: any) => void> = {}
  const cache = { match: vi.fn(), keys: vi.fn(async () => ['todoer-v3', 'todoer-v4', 'another-app']), delete: vi.fn(async (_key: string) => true) }
  const clients = { claim: vi.fn(), matchAll: vi.fn(async () => []), openWindow: vi.fn() }
  runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    URL, Response, caches: cache,
    self: { addEventListener: (name: string, fn: (event: any) => void) => { handlers[name] = fn }, location: { origin: 'https://todoer.example' }, clients },
  })
  return { handlers, cache, clients }
}

describe('service-worker privacy boundaries', () => {
  it('never intercepts authenticated, API or cross-origin task data', () => {
    const { handlers } = worker()
    for (const request of [
      new Request('https://db.supabase.co/rest/v1/tasks'),
      new Request('https://todoer.example/tasks', { headers: { authorization: 'Bearer test' } }),
      new Request('https://todoer.example/api/tasks'),
      new Request('https://todoer.example/tasks', { method: 'POST' }),
    ]) {
      const respondWith = vi.fn()
      handlers.fetch({ request, respondWith })
      expect(respondWith).not.toHaveBeenCalled()
    }
  })

  it('removes old Todoer caches without deleting another app cache', async () => {
    const { handlers, cache } = worker()
    let pending!: Promise<unknown>
    handlers.activate({ waitUntil: (promise: Promise<unknown>) => { pending = promise } })
    await pending
    expect(cache.delete.mock.calls.map(call => call[0])).toEqual(['todoer-v3'])
  })

  it.each(['https://outside.example/login', 'javascript:alert(1)', 'http://[broken', '/login'])('keeps notification navigation inside the app for %s', async url => {
    const { handlers, clients } = worker()
    let pending!: Promise<unknown>
    handlers.notificationclick({ notification: { data: { url }, close: vi.fn() }, waitUntil: (promise: Promise<unknown>) => { pending = promise } })
    await pending
    expect(clients.openWindow).toHaveBeenCalledWith('https://todoer.example/app/today')
  })
})
