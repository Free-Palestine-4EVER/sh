"use client"

import { useState, useEffect } from "react"
import { Wifi, WifiOff } from "lucide-react"
import { db } from "@/lib/firebase"
import { ref, onValue } from "firebase/database"

export default function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(true)
  const [connectionError, setConnectionError] = useState(false)

  useEffect(() => {
    // Set initial state
    setIsOnline(navigator.onLine)

    // Add event listeners for online/offline events
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Monitor Firebase connection state
    try {
      const connectedRef = ref(db, ".info/connected")
      const unsubscribe = onValue(
        connectedRef,
        (snap) => {
          setIsFirebaseConnected(!!snap.val())
          setConnectionError(false)
        },
        (error) => {
          console.error("Error monitoring connection:", error)
          setConnectionError(true)
          setIsFirebaseConnected(false)
        },
      )

      return () => {
        window.removeEventListener("online", handleOnline)
        window.removeEventListener("offline", handleOffline)
        unsubscribe()
      }
    } catch (error) {
      console.error("Error setting up connection monitoring:", error)
      setConnectionError(true)
      setIsFirebaseConnected(false)

      return () => {
        window.removeEventListener("online", handleOnline)
        window.removeEventListener("offline", handleOffline)
      }
    }
  }, [])

  if (!isOnline) {
    return (
      <div className="flex items-center text-red-500 text-xs">
        <WifiOff className="h-3 w-3 mr-1" />
        <span>Offline</span>
      </div>
    )
  }

  if (connectionError) {
    return (
      <div className="flex items-center text-yellow-500 text-xs">
        <Wifi className="h-3 w-3 mr-1" />
        <span>Connection issues</span>
      </div>
    )
  }

  if (!isFirebaseConnected) {
    return (
      <div className="flex items-center text-yellow-500 text-xs">
        <Wifi className="h-3 w-3 mr-1" />
        <span>Connecting to Firebase...</span>
      </div>
    )
  }

  return (
    <div className="flex items-center text-green-500 text-xs">
      <Wifi className="h-3 w-3 mr-1" />
      <span>Online</span>
    </div>
  )
}
