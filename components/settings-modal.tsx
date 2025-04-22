"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import type { User as UserType } from "@/lib/types"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { auth, db, storage } from "@/lib/firebase"
import { updateProfile } from "firebase/auth"
import { ref as dbRef, update } from "firebase/database"
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { useTheme } from "next-themes"
import { Moon, Sun, User, Bell } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import PushNotificationSettings from "./push-notification-settings"
import PushFooSettings from "./push-foo-settings"
import { isIOS, isPWAInstalled } from "@/lib/push-foo"

interface SettingsModalProps {
  user: UserType
  isOpen: boolean
  onClose: () => void
}

export default function SettingsModal({ user, isOpen, onClose }: SettingsModalProps) {
  const [username, setUsername] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState("notifications")
  const [isIOSPWA, setIsIOSPWA] = useState(false)

  // Initialize username when user data is available
  useEffect(() => {
    if (user && user.username) {
      setUsername(user.username)
    }

    // Check if this is an iOS PWA
    setIsIOSPWA(isIOS() && isPWAInstalled())
  }, [user])

  // Theme effect
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleUsernameChange = async () => {
    if (!username || !username.trim() || username === user.username) return

    try {
      setError(null)

      // Update Realtime Database document first
      const userRef = dbRef(db, `users/${user.id}`)
      await update(userRef, {
        username,
      })

      // Then update auth profile if available
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: username,
        })
      }

      onClose()
    } catch (error: any) {
      console.error("Error updating username:", error)
      setError(`Failed to update username: ${error.message}`)
    }
  }

  const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadProgress(0)
    setError(null)

    try {
      // First upload to Firebase Storage
      const profilePicRef = storageRef(storage, `profile_pictures/${user.id}/${Date.now()}_${file.name}`)
      const uploadTask = uploadBytesResumable(profilePicRef, file)

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          setUploadProgress(progress)
        },
        (error) => {
          console.error("Error uploading profile picture:", error)
          setError(`Upload failed: ${error.message}`)
          setIsUploading(false)
        },
      )

      // Wait for upload to complete
      await new Promise<void>((resolve, reject) => {
        uploadTask.on("state_changed", null, reject, () => resolve())
      })

      // Get download URL
      const downloadURL = await getDownloadURL(profilePicRef)

      // Update database first
      const userRef = dbRef(db, `users/${user.id}`)
      await update(userRef, {
        photoURL: downloadURL,
      })

      // Then update auth profile if available
      if (auth.currentUser) {
        try {
          await updateProfile(auth.currentUser, {
            photoURL: downloadURL,
          })
        } catch (authError: any) {
          console.error("Error updating auth profile, but database was updated:", authError)
          // Continue since the database was updated successfully
        }
      }

      setIsUploading(false)
      onClose()
    } catch (error: any) {
      console.error("Error in profile picture update process:", error)
      setError(`Failed to update profile picture: ${error.message}`)
      setIsUploading(false)
    }
  }

  const toggleTheme = () => {
    if (theme === "dark") {
      setTheme("light")
    } else {
      setTheme("dark")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span>Profile</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <span>Notifications</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                {user.photoURL && (
                  <Image
                    src={user.photoURL || "/placeholder.svg"}
                    alt={user.username || "User"}
                    width={100}
                    height={100}
                    className="rounded-full object-cover"
                  />
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="absolute bottom-0 right-0 rounded-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  Edit
                </Button>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleProfilePictureChange}
                  accept="image/*"
                  className="hidden"
                />
              </div>

              {isUploading && (
                <div className="w-full">
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                    <div className="h-2 bg-blue-500 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                    Uploading... {Math.round(uploadProgress)}%
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="username" className="text-gray-700 dark:text-gray-300">
                Username
              </Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700"
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-gray-700 dark:text-gray-300">Theme</Label>
              <div className="flex items-center justify-between">
                <span className="text-gray-900 dark:text-white">
                  {mounted && theme === "dark" ? "Dark Mode" : "Light Mode"}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleTheme}
                  disabled={!mounted}
                  className="border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                >
                  {mounted && theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6 py-4">
            {isIOSPWA ? <PushFooSettings user={user} /> : <PushNotificationSettings user={user} />}

            {isIOSPWA && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                  <AlertDescription>
                    <p className="font-medium">Using push.foo for iOS notifications</p>
                    <p className="text-sm mt-1">
                      This app uses push.foo technology to deliver reliable push notifications on iOS. No additional
                      setup is required!
                    </p>
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {activeTab === "profile" && (
            <Button
              onClick={handleUsernameChange}
              disabled={!username || !username.trim() || username === user.username}
              className="btn-primary"
            >
              Save Changes
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
