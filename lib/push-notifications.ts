// Helper functions for push notifications

// Check if the browser supports push notifications
export function isPushNotificationSupported() {
  return "serviceWorker" in navigator && "PushManager" in window
}

// Check if the device is iOS
export function isIOS() {
  return (
    ["iPad Simulator", "iPhone Simulator", "iPod Simulator", "iPad", "iPhone", "iPod"].includes(navigator.platform) ||
    // iPad on iOS 13 detection
    (navigator.userAgent.includes("Mac") && "ontouchend" in document)
  )
}

// Check if the PWA is installed (iOS home screen)
export function isPWAInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true
}

// Register the service worker
export async function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      })
      console.log("Service Worker registered with scope:", registration.scope)
      return registration
    } catch (error) {
      console.error("Service worker registration failed:", error)
      return null
    }
  }
  return null
}

// Convert base64 string to Uint8Array
export function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")

  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

// Subscribe to push notifications
export async function subscribeToPushNotifications(registration: ServiceWorkerRegistration, vapidPublicKey: string) {
  try {
    let subscription = await registration.pushManager.getSubscription()

    // If already subscribed, return the subscription
    if (subscription) {
      console.log("Already subscribed to push notifications")
      return subscription
    }

    // Convert the VAPID key to the format expected by the browser
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey)

    // Subscribe the user
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    })

    console.log("Subscribed to push notifications:", subscription)
    return subscription
  } catch (error) {
    console.error("Error subscribing to push notifications:", error)
    throw error
  }
}

// Unsubscribe from push notifications
export async function unsubscribeFromPushNotifications() {
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        const result = await subscription.unsubscribe()
        console.log("Unsubscribed from push notifications:", result)
        return result
      }

      return false
    } catch (error) {
      console.error("Error unsubscribing from push notifications:", error)
      throw error
    }
  }
  return false
}

// Check if notifications are enabled in the browser
export async function checkNotificationPermission() {
  if (!("Notification" in window)) {
    return "unsupported"
  }

  return Notification.permission
}

// Request notification permission
export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    return "unsupported"
  }

  const permission = await Notification.requestPermission()
  return permission
}

// Send a test notification
export async function sendTestNotification() {
  if (!("Notification" in window)) {
    throw new Error("Notifications not supported")
  }

  if (Notification.permission !== "granted") {
    throw new Error("Notification permission not granted")
  }

  const registration = await navigator.serviceWorker.ready

  registration.showNotification("Test Notification", {
    body: "This is a test notification from Chat App",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    vibrate: [200, 100, 200],
    tag: "test",
    renotify: true,
    actions: [
      {
        action: "view",
        title: "View",
      },
      {
        action: "close",
        title: "Close",
      },
    ],
  })
}
