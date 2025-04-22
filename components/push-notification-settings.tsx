"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { BellRing, BellOff, Smartphone, Info } from "lucide-react"
import type { User } from "@/lib/types"
import {
  isPushNotificationSupported,
  isIOS,
  isPWAInstalled,
  registerServiceWorker,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  checkNotificationPermission,
  requestNotificationPermission,
  sendTestNotification,
} from "@/lib/push-notifications"

interface PushNotificationSettingsProps {
  user: User
}

export default function PushNotificationSettings({ user }: PushNotificationSettingsProps) {
  const [isSupported, setIsSupported] = useState(false)
  const [isConfigured, setIsConfigured] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notificationPermission, setNotificationPermission] = useState<string>("default")
  const [isIosDevice, setIsIosDevice] = useState(false)
  const [isPwaInstalled, setIsPwaInstalled] = useState(false)
  const [showTestButton, setShowTestButton] = useState(false)

  useEffect(() => {
    // Check if push notifications are supported and configured
    const checkSupport = async () => {
      const supported = isPushNotificationSupported()
      setIsSupported(supported)
      setIsIosDevice(isIOS())
      setIsPwaInstalled(isPWAInstalled())

      if (supported) {
        try {
          // Check notification permission
          const permission = await checkNotificationPermission()
          setNotificationPermission(permission)

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
            setShowTestButton(!!subscription && permission === "granted")
          }
        } catch (error) {
          console.error("Error checking push notification status:", error)
          setError("Failed to check push notification configuration.")
        }
      }
    }

    checkSupport()

    // Add event listener for display mode changes (for PWA detection)
    const mediaQueryList = window.matchMedia("(display-mode: standalone)")
    const handleChange = (e: MediaQueryListEvent) => {
      setIsPwaInstalled(e.matches)
    }

    mediaQueryList.addEventListener("change", handleChange)

    return () => {
      mediaQueryList.removeEventListener("change", handleChange)
    }
  }, [])

  const handleSubscribe = async () => {
    if (!isSupported || !isConfigured || !user) return

    setIsLoading(true)
    setError(null)

    try {
      // First request notification permission if not granted
      if (notificationPermission !== "granted") {
        const permission = await requestNotificationPermission()
        setNotificationPermission(permission)

        if (permission !== "granted") {
          setError("Notification permission denied. Please enable notifications in your browser settings.")
          setIsLoading(false)
          return
        }
      }

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
          setShowTestButton(true)
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
        setShowTestButton(false)
      }
    } catch (error: any) {
      console.error("Error unsubscribing from push notifications:", error)
      setError(`Failed to unsubscribe: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleTestNotification = async () => {
    try {
      await sendTestNotification()
    } catch (error: any) {
      console.error("Error sending test notification:", error)
      setError(`Failed to send test notification: ${error.message}`)
    }
  }

  if (!isSupported) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BellOff className="h-5 w-5 text-gray-500" />
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Push Notifications</h3>
          </div>
        </div>
        <Alert>
          <AlertDescription>Push notifications are not supported in your browser.</AlertDescription>
        </Alert>
      </div>
    )
  }

  // Special message for iOS users
  if (isIosDevice && !isPwaInstalled) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BellRing className="h-5 w-5 text-gray-500" />
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Push Notifications</h3>
          </div>
        </div>
        <Alert>
          <Smartphone className="h-4 w-4 mr-2" />
          <AlertDescription>
            <p className="font-medium">For iOS users:</p>
            <ol className="list-decimal pl-5 mt-2 space-y-1 text-sm">
              <li>Add this app to your home screen first</li>
              <li>Open the app from your home screen</li>
              <li>Then you can enable push notifications</li>
            </ol>
            <p className="mt-2 text-sm">To add to home screen: tap the share icon and select "Add to Home Screen"</p>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <BellRing className="h-5 w-5 text-gray-500" />
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Push Notifications</h3>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!isConfigured && (
        <Alert>
          <Info className="h-4 w-4 mr-2" />
          <AlertDescription>
            Push notifications are not configured. Please add VAPID keys to your environment variables.
          </AlertDescription>
        </Alert>
      )}

      {isIosDevice && isPwaInstalled && isSubscribed && (
        <Alert>
          <Info className="h-4 w-4 mr-2" />
          <AlertDescription>You've successfully enabled push notifications on your iOS device!</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col space-y-2">
        {isSubscribed ? (
          <>
            <Button
              variant="outline"
              onClick={handleUnsubscribe}
              disabled={isLoading || !isConfigured}
              className="w-full"
            >
              {isLoading ? "Processing..." : "Unsubscribe from Notifications"}
            </Button>

            {showTestButton && (
              <Button variant="secondary" onClick={handleTestNotification} className="w-full">
                Send Test Notification
              </Button>
            )}
          </>
        ) : (
          <Button
            variant="default"
            onClick={handleSubscribe}
            disabled={isLoading || !isConfigured}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? "Processing..." : "Subscribe to Notifications"}
          </Button>
        )}
      </div>
      {isSupported && (
        <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-md text-xs">
          <h4 className="font-medium mb-1">Notification Status:</h4>
          <ul className="space-y-1">
            <li>
              • Browser Support: <span className="font-medium text-green-500">Available</span>
            </li>
            <li>
              • Permission:{" "}
              <span
                className={`font-medium ${
                  notificationPermission === "granted"
                    ? "text-green-500"
                    : notificationPermission === "denied"
                      ? "text-red-500"
                      : "text-yellow-500"
                }`}
              >
                {notificationPermission}
              </span>
            </li>
            <li>
              • VAPID Keys:{" "}
              <span className={`font-medium ${isConfigured ? "text-green-500" : "text-red-500"}`}>
                {isConfigured ? "Configured" : "Missing"}
              </span>
            </li>
            <li>
              • Subscription:{" "}
              <span className={`font-medium ${isSubscribed ? "text-green-500" : "text-yellow-500"}`}>
                {isSubscribed ? "Active" : "Not subscribed"}
              </span>
            </li>
            <li>
              • iOS Device: <span className="font-medium">{isIosDevice ? "Yes" : "No"}</span>
            </li>
            <li>
              • PWA Installed: <span className="font-medium">{isPwaInstalled ? "Yes" : "No"}</span>
            </li>
          </ul>
          {error && (
            <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 rounded text-red-700 dark:text-red-300">{error}</div>
          )}
        </div>
      )}
    </div>
  )
}
