"use client"

import { useEffect, useState } from "react"
import { useFirebase } from "@/components/firebase-provider"
import {
  isPushNotificationSupported,
  registerServiceWorker,
  checkNotificationPermission,
  subscribeToPushNotifications,
} from "@/lib/push-notifications"

export default function PushNotificationInitializer() {
  const { user } = useFirebase()
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    // Only run once
    if (initialized) return
    setInitialized(true)

    const initializePushNotifications = async () => {
      // Check if push notifications are supported
      if (!isPushNotificationSupported()) {
        console.log("Push notifications are not supported in this browser")
        return
      }

      try {
        // Register service worker
        const registration = await registerServiceWorker()
        if (!registration) {
          console.error("Failed to register service worker")
          return
        }

        // Check if we already have a subscription
        const existingSubscription = await registration.pushManager.getSubscription()
        if (existingSubscription) {
          console.log("Push notification subscription already exists")
          return
        }

        // Check notification permission
        const permission = await checkNotificationPermission()
        if (permission === "granted") {
          console.log("Notification permission already granted")

          // Auto-subscribe if permission is already granted
          const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
          if (vapidPublicKey && user) {
            try {
              const subscription = await subscribeToPushNotifications(registration, vapidPublicKey)

              // Save subscription to server
              await fetch("/api/save-subscription", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  userId: user.uid,
                  subscription,
                }),
              })

              console.log("Auto-subscribed to push notifications")
            } catch (error) {
              console.error("Failed to auto-subscribe to push notifications:", error)
            }
          }
        } else {
          console.log("Notification permission not granted yet")
        }
      } catch (error) {
        console.error("Error initializing push notifications:", error)
      }
    }

    // Initialize push notifications after a short delay to ensure the app is fully loaded
    const timer = setTimeout(() => {
      if (user) {
        initializePushNotifications()
      }
    }, 2000)

    return () => clearTimeout(timer)
  }, [user, initialized])

  // This component doesn't render anything
  return null
}
