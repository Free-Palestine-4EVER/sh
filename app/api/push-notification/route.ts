import { NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { ref, get } from "firebase/database"
import webpush from "web-push"

// Create a function to initialize web-push that we'll only call during runtime
function initializeWebPush() {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("VAPID keys are missing. Push notifications will not work.")
    return false
  }

  try {
    webpush.setVapidDetails(
      "mailto:example@yourdomain.com", // Replace with your actual email
      vapidPublicKey,
      vapidPrivateKey,
    )
    return true
  } catch (error) {
    console.error("Failed to initialize web-push:", error)
    return false
  }
}

export async function POST(request: Request) {
  try {
    // Initialize web-push only at runtime
    const isPushInitialized = initializeWebPush()

    if (!isPushInitialized) {
      return NextResponse.json(
        { error: "Push notification service is not configured. VAPID keys are missing or invalid." },
        { status: 500 },
      )
    }

    const { subscription, userId, message, chatId, senderId, title } = await request.json()

    if (!subscription) {
      return NextResponse.json({ error: "Missing subscription" }, { status: 400 })
    }

    // Get sender data if senderId is provided
    let senderName = "Someone"
    let senderPhoto = "/icons/icon-192x192.png"

    if (senderId) {
      try {
        const senderRef = ref(db, `users/${senderId}`)
        const senderSnapshot = await get(senderRef)

        if (senderSnapshot.exists()) {
          const senderData = senderSnapshot.val()
          senderName = senderData.username || "Someone"
          senderPhoto = senderData.photoURL || "/icons/icon-192x192.png"
        }
      } catch (error) {
        console.error("Error fetching sender data:", error)
      }
    }

    // Prepare notification payload
    const payload = JSON.stringify({
      title: title || `New message from ${senderName}`,
      body: message || "You have a new message",
      icon: senderPhoto,
      badge: "/icons/icon-192x192.png",
      tag: chatId || "message",
      data: {
        url: "/",
        chatId: chatId,
        senderId: senderId,
      },
    })

    // Send push notification
    await webpush.sendNotification(subscription, payload)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error sending push notification:", error)

    // More detailed error response
    let errorMessage = "Failed to send push notification"
    let statusCode = 500

    if (error.statusCode === 410) {
      errorMessage = "Subscription has expired or is no longer valid"
      statusCode = 410
    } else if (error.statusCode === 404) {
      errorMessage = "Push subscription not found"
      statusCode = 404
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: error.message,
        code: error.statusCode || 500,
      },
      { status: statusCode },
    )
  }
}
