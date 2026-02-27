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
    // TODO: Send token to your backend to store for this user
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
      window.location.href = action.notification.data.url
    }
  })
}
