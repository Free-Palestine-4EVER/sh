// Service Worker for Push Notifications and PWA functionality
self.addEventListener("install", (event) => {
  self.skipWaiting()
  console.log("Service Worker installed")
})

self.addEventListener("activate", (event) => {
  console.log("Service Worker activated")
  return self.clients.claim()
})

// Handle push events
self.addEventListener("push", (event) => {
  console.log("Push event received:", event)

  let notificationData = {}

  try {
    if (event.data) {
      notificationData = event.data.json()
    }
  } catch (e) {
    console.error("Error parsing push data:", e)
    notificationData = {
      title: "New Message",
      body: "You have a new message",
      icon: "/icons/icon-192x192.png",
    }
  }

  const title = notificationData.title || "New Message"
  const options = {
    body: notificationData.body || "You have a new message",
    icon: notificationData.icon || "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    data: {
      url: notificationData.url || "/",
      chatId: notificationData.chatId,
      senderId: notificationData.senderId,
    },
    vibrate: [200, 100, 200], // Required for iOS
    tag: notificationData.tag || "message",
    renotify: true,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  console.log("Notification clicked:", event)

  event.notification.close()

  // Handle notification action clicks
  if (event.action === "close") {
    return
  }

  // Default action is to open the chat
  const urlToOpen = event.notification.data?.url || "/"
  const chatId = event.notification.data?.chatId

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus().then((client) => {
            if (chatId) {
              // Post message to client to open specific chat
              return client.postMessage({
                type: "OPEN_CHAT",
                chatId: chatId,
                senderId: event.notification.data?.senderId,
              })
            }
            return client
          })
        }
      }

      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    }),
  )
})

// Handle push subscription change
self.addEventListener("pushsubscriptionchange", (event) => {
  console.log("Push subscription changed")

  const applicationServerKey = event.oldSubscription?.options?.applicationServerKey

  event.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey,
      })
      .then((subscription) => {
        // Get the current user ID from IndexedDB or other storage
        return fetch("/api/update-subscription", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ subscription }),
        })
      }),
  )
})
