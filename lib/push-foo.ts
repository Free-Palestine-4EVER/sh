// push.foo implementation for iOS PWA push notifications
// Based on https://github.com/webmaxru/push.foo

// Function to check if the device is iOS
export function isIOS() {
  return (
    ["iPad Simulator", "iPhone Simulator", "iPod Simulator", "iPad", "iPhone", "iPod"].includes(navigator.platform) ||
    // iPad on iOS 13+ detection
    (navigator.userAgent.includes("Mac") && "ontouchend" in document)
  )
}

// Check if the PWA is installed (iOS home screen)
export function isPWAInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true
}

// Initialize push.foo for iOS
export async function initializePushFoo(userId: string) {
  if (!isIOS() || !isPWAInstalled()) {
    console.log("Not iOS or not installed as PWA, skipping push.foo")
    return false
  }

  try {
    // Create a unique identifier for this user/device
    const deviceId = `${userId}-${Date.now()}`

    // Register with push.foo service
    const response = await fetch("https://push.foo/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        deviceId,
        userId,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to register with push.foo: ${response.statusText}`)
    }

    const data = await response.json()

    // Store the push.foo token in localStorage
    localStorage.setItem("pushFooToken", data.token)
    localStorage.setItem("pushFooDeviceId", deviceId)

    console.log("Successfully registered with push.foo")
    return true
  } catch (error) {
    console.error("Error initializing push.foo:", error)
    return false
  }
}

// Send a notification using push.foo
export async function sendPushFooNotification(targetUserId: string, title: string, body: string, data: any = {}) {
  try {
    const response = await fetch("https://push.foo/api/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: targetUserId,
        notification: {
          title,
          body,
          data,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to send push.foo notification: ${response.statusText}`)
    }

    return true
  } catch (error) {
    console.error("Error sending push.foo notification:", error)
    return false
  }
}

// Start polling for notifications (for iOS)
export function startPushFooPolling(userId: string, onNotification: (notification: any) => void) {
  if (!isIOS() || !isPWAInstalled()) {
    return null
  }

  const deviceId = localStorage.getItem("pushFooDeviceId")
  if (!deviceId) {
    console.error("No push.foo device ID found")
    return null
  }

  console.log("Starting push.foo polling for notifications")

  // Poll for notifications every 30 seconds
  const intervalId = setInterval(async () => {
    try {
      const response = await fetch(`https://push.foo/api/notifications?userId=${userId}&deviceId=${deviceId}`)

      if (!response.ok) {
        throw new Error(`Failed to poll for notifications: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.notifications && data.notifications.length > 0) {
        // Process each notification
        data.notifications.forEach((notification: any) => {
          onNotification(notification)

          // Show the notification using the Notification API if the app is in the background
          if (document.visibilityState !== "visible" && "Notification" in window) {
            new Notification(notification.title, {
              body: notification.body,
              icon: "/icons/icon-192x192.png",
              data: notification.data,
            })
          }
        })

        // Acknowledge notifications
        await fetch(`https://push.foo/api/acknowledge`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            deviceId,
            notificationIds: data.notifications.map((n: any) => n.id),
          }),
        })
      }
    } catch (error) {
      console.error("Error polling for push.foo notifications:", error)
    }
  }, 30000) // Poll every 30 seconds

  return intervalId
}

// Stop polling for notifications
export function stopPushFooPolling(intervalId: number | null) {
  if (intervalId) {
    clearInterval(intervalId)
  }
}
