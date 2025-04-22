"use client"

import { useState, useEffect } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Smartphone, X } from "lucide-react"
import { isIOS, isPWAInstalled } from "@/lib/push-foo"

export default function IOSInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    // Check if it's iOS and not already installed
    const isIosDevice = isIOS()
    const isPwaInstalled = isPWAInstalled()

    // Check if previously dismissed
    const previouslyDismissed = localStorage.getItem("iosPromptDismissed") === "true"

    // Show for iOS devices that haven't installed the PWA and haven't dismissed
    setShowPrompt(isIosDevice && !isPwaInstalled && !previouslyDismissed)

    // Check every 30 seconds if the app has been installed
    const checkInterval = setInterval(() => {
      if (isPWAInstalled()) {
        setShowPrompt(false)
        clearInterval(checkInterval)
      }
    }, 30000)

    return () => clearInterval(checkInterval)
  }, [])

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem("iosPromptDismissed", "true")
    setIsDismissed(true)
  }

  if (!showPrompt || isDismissed) {
    return null
  }

  return (
    <Alert className="fixed bottom-4 left-4 right-4 z-50 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 shadow-lg">
      <div className="flex items-start justify-between">
        <div className="flex">
          <Smartphone className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0" />
          <div>
            <AlertTitle className="text-blue-700 dark:text-blue-300 font-bold">
              Install this app on your iPhone for push notifications
            </AlertTitle>
            <AlertDescription className="mt-2">
              <p className="font-medium">For push.foo notifications to work on iOS:</p>
              <ol className="list-decimal pl-5 mt-2 space-y-1 text-sm">
                <li>
                  Tap the share icon{" "}
                  <span className="inline-block w-5 h-5 text-center leading-5 bg-gray-200 dark:bg-gray-700 rounded">
                    ↑
                  </span>
                </li>
                <li>Scroll down and select "Add to Home Screen"</li>
                <li>Tap "Add" in the top right corner</li>
                <li>Open the app from your home screen</li>
                <li>Push notifications will work automatically!</li>
              </ol>
              <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                Note: This app uses push.foo technology for reliable iOS notifications
              </p>
            </AlertDescription>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={handleDismiss} className="mt-1 flex-shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  )
}
