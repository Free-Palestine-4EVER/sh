"use client"

import { useEffect, useState } from "react"
import { useFirebase } from "@/components/firebase-provider"
import { isIOS, isPWAInstalled, initializePushFoo, startPushFooPolling, stopPushFooPolling } from "@/lib/push-foo"

export default function PushFooHandler() {
  const { user } = useFirebase()
  const [pollingInterval, setPollingInterval] = useState<number | null>(null)

  useEffect(() => {
    // Only run for iOS devices installed as PWA
    if (!isIOS() || !isPWAInstalled() || !user) {
      return
    }

    const setupPushFoo = async () => {
      try {
        // Initialize push.foo
        await initializePushFoo(user.uid)

        // Start polling for notifications
        const intervalId = startPushFooPolling(user.uid, (notification) => {
          console.log("Received notification from push.foo:", notification)

          // Handle the notification - e.g., update UI, play sound, etc.
          if (notification.data && notification.data.chatId) {
            // Post message to open the chat
            window.postMessage(
              {
                type: "OPEN_CHAT",
                chatId: notification.data.chatId,
                senderId: notification.data.senderId,
              },
              "*",
            )
          }
        })

        setPollingInterval(intervalId)
      } catch (error) {
        console.error("Error setting up push.foo:", error)
      }
    }

    setupPushFoo()

    // Clean up
    return () => {
      stopPushFooPolling(pollingInterval)
    }
  }, [user])

  // This component doesn't render anything
  return null
}
