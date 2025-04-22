"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { BellRing, Smartphone, Info } from "lucide-react"
import type { User } from "@/lib/types"
import { isIOS, isPWAInstalled, initializePushFoo } from "@/lib/push-foo"

interface PushFooSettingsProps {
  user: User
}

export default function PushFooSettings({ user }: PushFooSettingsProps) {
  const [isIosDevice, setIsIosDevice] = useState(false)
  const [isPwaInstalled, setIsPwaInstalled] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check if it's iOS and installed as PWA
    const iosDevice = isIOS()
    const pwaInstalled = isPWAInstalled()

    setIsIosDevice(iosDevice)
    setIsPwaInstalled(pwaInstalled)

    // Check if push.foo is already initialized
    const pushFooToken = localStorage.getItem("pushFooToken")
    setIsInitialized(!!pushFooToken)
  }, [])

  const handleInitialize = async () => {
    if (!user) return

    setIsLoading(true)
    setError(null)

    try {
      const success = await initializePushFoo(user.id)
      if (success) {
        setIsInitialized(true)
      } else {
        setError("Failed to initialize push.foo. Please try again.")
      }
    } catch (error: any) {
      console.error("Error initializing push.foo:", error)
      setError(`Error: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    localStorage.removeItem("pushFooToken")
    localStorage.removeItem("pushFooDeviceId")
    setIsInitialized(false)
  }

  if (!isIosDevice) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BellRing className="h-5 w-5 text-gray-500" />
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">iOS Push Notifications</h3>
          </div>
        </div>
        <Alert>
          <AlertDescription>push.foo notifications are only available on iOS devices.</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!isPwaInstalled) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BellRing className="h-5 w-5 text-gray-500" />
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">iOS Push Notifications</h3>
          </div>
        </div>
        <Alert>
          <Smartphone className="h-4 w-4 mr-2" />
          <AlertDescription>
            <p className="font-medium">For iOS push.foo notifications:</p>
            <ol className="list-decimal pl-5 mt-2 space-y-1 text-sm">
              <li>Add this app to your home screen first</li>
              <li>Open the app from your home screen</li>
              <li>Then push.foo notifications will work automatically</li>
            </ol>
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
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">iOS Push Notifications (push.foo)</h3>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isInitialized ? (
        <Alert>
          <Info className="h-4 w-4 mr-2" />
          <AlertDescription>
            <p className="font-medium text-green-600 dark:text-green-400">
              push.foo notifications are enabled! You will receive notifications when the app is in the background.
            </p>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <Info className="h-4 w-4 mr-2" />
          <AlertDescription>push.foo provides reliable push notifications for iOS PWAs.</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col space-y-2">
        {isInitialized ? (
          <Button variant="outline" onClick={handleReset} className="w-full">
            Reset push.foo Configuration
          </Button>
        ) : (
          <Button
            variant="default"
            onClick={handleInitialize}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? "Initializing..." : "Enable push.foo Notifications"}
          </Button>
        )}
      </div>

      <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-md text-xs">
        <h4 className="font-medium mb-1">push.foo Status:</h4>
        <ul className="space-y-1">
          <li>
            • iOS Device: <span className="font-medium text-green-500">Yes</span>
          </li>
          <li>
            • PWA Installed: <span className="font-medium text-green-500">Yes</span>
          </li>
          <li>
            • push.foo Initialized:{" "}
            <span className={`font-medium ${isInitialized ? "text-green-500" : "text-yellow-500"}`}>
              {isInitialized ? "Yes" : "No"}
            </span>
          </li>
        </ul>
      </div>
    </div>
  )
}
