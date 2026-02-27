'use client'

import { useEffect } from 'react'
import { isNative } from '@/lib/native/platform'

export function NativeInit() {
  useEffect(() => {
    if (!isNative()) return

    const init = async () => {
      // Status bar
      const { StatusBar, Style } = await import('@capacitor/status-bar')
      await StatusBar.setStyle({ style: Style.Dark })
      await StatusBar.setBackgroundColor({ color: '#0a0a0a' })

      // Keyboard
      const { Keyboard } = await import('@capacitor/keyboard')
      Keyboard.addListener('keyboardWillShow', () => {
        document.body.classList.add('keyboard-open')
      })
      Keyboard.addListener('keyboardWillHide', () => {
        document.body.classList.remove('keyboard-open')
      })

      // App state — refetch data when returning from background
      const { App } = await import('@capacitor/app')
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          window.dispatchEvent(new Event('focus'))
        }
      })

      // Push notifications
      const { initPushNotifications } = await import('@/lib/native/notifications')
      await initPushNotifications()

      // Splash screen — hide after init
      const { SplashScreen } = await import('@capacitor/splash-screen')
      await SplashScreen.hide()
    }

    init().catch(console.error)
  }, [])

  return null
}
