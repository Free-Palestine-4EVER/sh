"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { User } from "@/lib/types"
import {
  registerServiceWorker,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
} from "@/lib/push-notifications"

interface PushNotificationManagerProps {
  user: User
}

export default function PushNotificationManager({ user }: PushNotificationManagerProps) {
  const [isSupported, setIsSupported] = useState(false)
  const [isConfigured, setIsConfigured] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check if push notifications are supported and configured
    const checkSupport = async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window
      setIsSupported(supported)

      if (supported) {
        try {
          // Check if push notifications are configured on the server
          const response = await fetch("/api/push-status")
          const data = await response.json()
          setIsConfigured(data.pushNotificationsConfigured)

          if (!data.pushNotificationsConfigured) {
            setError("Push notifications are not configured on the server.")
            return
          }

          const registration = await registerServiceWorker()
          if (registration) {
            const subscription = await registration.pushManager.getSubscription()
            setIsSubscribed(!!subscription)
          }
        } catch (error) {
          console.error("Error checking push notification status:", error)
          setError("Failed to check push notification configuration.")
        }
      }
    }

    checkSupport()
  }, [])

  const handleSubscribe = async () => {
    if (!isSupported || !isConfigured || !user) return

    setIsLoading(true)
    setError(null)

    try {
      const registration = await registerServiceWorker()

      if (registration) {
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

        if (!vapidPublicKey) {
          setError("Push notifications are not configured. VAPID public key is missing.")
          setIsLoading(false)
          return
        }

        const subscription = await subscribeToPushNotifications(registration, vapidPublicKey)

        if (subscription) {
          // Save subscription to the server
          await fetch("/api/save-subscription", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              userId: user.id,
              subscription,
            }),
          })

          setIsSubscribed(true)
        }
      }
    } catch (error: any) {
      console.error("Error subscribing to push notifications:", error)
      setError(`Failed to subscribe: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUnsubscribe = async () => {
    if (!isSupported || !user) return

    setIsLoading(true)
    setError(null)

    try {
      const success = await unsubscribeFromPushNotifications()

      if (success) {
        // Delete subscription from the server
        await fetch("/api/delete-subscription", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: user.id,
          }),
        })

        setIsSubscribed(false)
      }
    } catch (error: any) {
      console.error("Error unsubscribing from push notifications:", error)
      setError(`Failed to unsubscribe: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isSupported) {
    return null
  }

  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium mb-2">Push Notifications</h3>

      {error && (
        <Alert variant="destructive" className="mb-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!isConfigured ? (
        <Alert className="mb-2">
          <AlertDescription>
            Push notifications are not configured. Please add VAPID keys to your environment variables.
          </AlertDescription>
        </Alert>
      ) : isSubscribed ? (
        <Button variant="outline" size="sm" onClick={handleUnsubscribe} disabled={isLoading}>
          {isLoading ? "Unsubscribing..." : "Unsubscribe from Notifications"}
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={handleSubscribe} disabled={isLoading}>
          {isLoading ? "Subscribing..." : "Subscribe to Notifications"}
        </Button>
      )}
    </div>
  )
}
