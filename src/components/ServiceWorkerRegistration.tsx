'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker and provides push notification subscription utilities.
 * Include this component once in the root layout.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[SW] Service worker registered, scope:', registration.scope)

        // Check for updates periodically (every 60 minutes)
        setInterval(() => {
          registration.update()
        }, 1000 * 60 * 60)
      })
      .catch((error) => {
        console.error('[SW] Service worker registration failed:', error)
      })
  }, [])

  return null
}

/**
 * Request permission and subscribe to push notifications.
 * Returns the PushSubscription object if successful, or null if denied/unsupported.
 *
 * @param vapidPublicKey - The VAPID public key from your server (base64 encoded)
 */
export async function subscribeToPushNotifications(
  vapidPublicKey: string
): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[SW] Push notifications are not supported in this browser')
    return null
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    console.warn('[SW] Notification permission denied')
    return null
  }

  const registration = await navigator.serviceWorker.ready

  // Convert the VAPID key from base64 to Uint8Array
  const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey)

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
  })

  console.log('[SW] Push subscription created:', subscription.endpoint)
  return subscription
}

/**
 * Unsubscribe from push notifications.
 * Returns true if successfully unsubscribed.
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()

  if (!subscription) return false

  const success = await subscription.unsubscribe()
  console.log('[SW] Push unsubscribed:', success)
  return success
}

/**
 * Get the current push notification subscription, if any.
 */
export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null

  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

/**
 * Convert a base64 VAPID key to a Uint8Array for the Push API.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
