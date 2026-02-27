import { isNative } from './platform'

export async function initPushNotifications() {
  if (!isNative()) {
    // On web, use existing Service Worker push (no changes needed)
    return
  }

  // Dynamic import to avoid loading native modules on web
  const { PushNotifications } = await import('@capacitor/push-notifications')

  let permStatus = await PushNotifications.checkPermissions()

  if (permStatus.receive === 'prompt') {
    permStatus = await PushNotifications.requestPermissions()
  }

  if (permStatus.receive !== 'granted') {
    console.warn('[Push] Permission denied')
    return
  }

  await PushNotifications.register()

  PushNotifications.addListener('registration', (token) => {
    console.log('[Push] Native token:', token.value)
    // WARNING: Push token is not being sent to the backend.
    // Notifications will NOT be delivered until this token is persisted
    // server-side (e.g. via a Supabase edge function or API route) and
    // used to send messages through FCM/APNs.
    console.warn(
      '[Push] Token received but not sent to backend — push notifications are not fully configured. ' +
      'Implement a backend endpoint to store this token for the current user.'
    )
  })

  PushNotifications.addListener('registrationError', (error) => {
    console.error('[Push] Registration error:', error.error)
  })

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('[Push] Received:', notification)
  })

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    console.log('[Push] Action:', action.actionId)
    if (action.notification.data?.url) {
      const url = action.notification.data.url
      if (url.startsWith('/app/') || url.startsWith('/login')) {
        window.location.href = url
      } else {
        console.warn('[Push] Blocked navigation to external URL:', url)
      }
    }
  })
}
