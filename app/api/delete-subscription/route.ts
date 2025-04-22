import { NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { ref, update } from "firebase/database"

export async function POST(request: Request) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: "Missing user ID" }, { status: 400 })
    }

    // Remove subscription from user document
    await update(ref(db, `users/${userId}`), {
      pushSubscription: null,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting push subscription:", error)
    return NextResponse.json({ error: "Failed to delete subscription" }, { status: 500 })
  }
}
