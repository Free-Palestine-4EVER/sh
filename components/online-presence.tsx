"use client"

import { useEffect } from "react"
import { db } from "@/lib/firebase"
import { ref, onDisconnect, set, serverTimestamp } from "firebase/database"
import { useFirebase } from "@/components/firebase-provider"

export default function OnlinePresence() {
  const { user } = useFirebase()

  useEffect(() => {
    if (!user) return

    // Use a separate presence node instead of updating the user document
    const presenceRef = ref(db, `presence/${user.uid}`)

    // Set up presence tracking
    const setupPresence = async () => {
      try {
        // Set up onDisconnect to update status when user disconnects
        await onDisconnect(presenceRef).set({
          online: false,
          lastSeen: serverTimestamp(),
        })

        // Set online status
        await set(presenceRef, {
          online: true,
          lastSeen: serverTimestamp(),
        })

        console.log("Online presence setup successfully")
      } catch (error) {
        console.error("Error setting up presence:", error)
      }
    }

    setupPresence()

    // Set up interval to update lastSeen periodically
    const interval = setInterval(() => {
      set(presenceRef, {
        online: true,
        lastSeen: serverTimestamp(),
      }).catch((err) => console.error("Error updating presence:", err))
    }, 300000) // Every 5 minutes

    // Update when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        set(presenceRef, {
          online: true,
          lastSeen: serverTimestamp(),
        }).catch((err) => console.error("Error updating presence on visibility change:", err))
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    // Clean up
    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibilityChange)

      // Set offline status when component unmounts
      set(presenceRef, {
        online: false,
        lastSeen: serverTimestamp(),
      }).catch(() => {})
    }
  }, [user])

  return null
}
