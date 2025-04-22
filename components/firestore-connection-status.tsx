"use client"

import { useEffect, useState } from "react"
import { db } from "@/lib/firebase"
import { collection, doc, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCw } from "lucide-react"

export default function FirestoreConnectionStatus() {
  const [isConnected, setIsConnected] = useState(true)
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    // Create a connection status checker
    const checkConnection = async () => {
      if (!db) return

      try {
        setIsChecking(true)

        // Create a temporary document to test connection
        const testDocRef = doc(collection(db, "_connection_test"))

        // Try to write to Firestore
        await setDoc(testDocRef, {
          timestamp: serverTimestamp(),
        })

        // If we get here, we're connected
        setIsConnected(true)

        // Clean up the test document
        await deleteDoc(testDocRef)
      } catch (error) {
        console.error("Firestore connection test failed:", error)
        setIsConnected(false)
      } finally {
        setIsChecking(false)
      }
    }

    // Check connection initially
    checkConnection()

    // Set up online/offline listeners
    const handleOnline = () => {
      checkConnection()
    }

    const handleOffline = () => {
      setIsConnected(false)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  if (isConnected) return null

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Connection Error</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>
          Unable to connect to Firebase. This may be due to network issues or incorrect Firebase configuration.
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
          disabled={isChecking}
          className="ml-2"
        >
          {isChecking ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </>
          )}
        </Button>
      </AlertDescription>
    </Alert>
  )
}
