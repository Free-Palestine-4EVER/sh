import { NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { ref, set } from "firebase/database"

export async function POST(request: Request) {
  try {
    const { userId, deviceId, notification } = await request.json()

    if (!userId || !deviceId || !notification) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    // Store the notification in Firebase for the client to poll
    const notificationRef = ref(db, `push_foo_notifications/${userId}/${deviceId}/${Date.now()}`)
    await set(notificationRef, notification)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error handling push.foo webhook:", error)
    return NextResponse.json({ error: "Failed to process notification" }, { status: 500 })
  }
}
