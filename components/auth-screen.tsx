"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, RefreshCw } from "lucide-react"
import { auth, db } from "@/lib/firebase"
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth"
import { ref, set, serverTimestamp, get, update } from "firebase/database"

export default function AuthScreen() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isOnline, setIsOnline] = useState(true)

  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")

  const [registerEmail, setRegisterEmail] = useState("")
  const [registerPassword, setRegisterPassword] = useState("")
  const [username, setUsername] = useState("")

  // Monitor online status
  useEffect(() => {
    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isOnline) {
      setError("You are offline. Please check your internet connection.")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword)
      const user = userCredential.user

      // Check if user data exists in the database
      const userRef = ref(db, `users/${user.uid}`)
      const snapshot = await get(userRef)

      const defaultUsername = user.displayName || loginEmail.split("@")[0]
      const defaultPhotoURL =
        user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(defaultUsername)}&background=random`

      // If user data doesn't exist, create it
      if (!snapshot.exists()) {
        console.log("Creating new user data for:", user.uid)
        await set(userRef, {
          id: user.uid,
          username: defaultUsername,
          email: user.email,
          photoURL: defaultPhotoURL,
          lastSeen: serverTimestamp(),
          createdAt: serverTimestamp(),
          online: true,
        })
      } else {
        // Update existing user data
        console.log("Updating existing user data for:", user.uid)
        const userData = snapshot.val()

        // Ensure all required fields exist
        const updatedData = {
          lastSeen: serverTimestamp(),
          online: true,
          // Ensure these fields exist, use existing data or defaults
          username: userData.username || defaultUsername,
          email: userData.email || user.email,
          photoURL: userData.photoURL || defaultPhotoURL,
          id: user.uid,
        }

        if (!userData.createdAt) {
          updatedData.createdAt = serverTimestamp()
        }

        await update(userRef, updatedData)

        // Also update auth profile if needed
        if (!user.displayName || !user.photoURL) {
          try {
            await updateProfile(user, {
              displayName: updatedData.username,
              photoURL: updatedData.photoURL,
            })
          } catch (profileError) {
            console.error("Error updating auth profile:", profileError)
            // Continue anyway since database was updated
          }
        }
      }
    } catch (error: any) {
      console.error("Login error:", error)

      if (error.code === "auth/network-request-failed") {
        setError("Network error. Please check your internet connection and try again.")
      } else if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
        setError("Invalid email or password.")
      } else {
        setError(error.message || "An error occurred during login.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isOnline) {
      setError("You are offline. Please check your internet connection.")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, registerEmail, registerPassword)
      const user = userCredential.user

      const photoURL = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random`

      // Update profile with username
      await updateProfile(user, {
        displayName: username,
        photoURL: photoURL,
      })

      // Create user document in Realtime Database
      await set(ref(db, `users/${user.uid}`), {
        id: user.uid,
        username: username,
        email: registerEmail,
        photoURL: photoURL,
        lastSeen: serverTimestamp(),
        createdAt: serverTimestamp(),
        online: true,
      })
    } catch (error: any) {
      console.error("Registration error:", error)

      if (error.code === "auth/network-request-failed") {
        setError("Network error. Please check your internet connection and try again.")
      } else if (error.code === "auth/email-already-in-use") {
        setError("This email is already registered. Please use a different email or try logging in.")
      } else if (error.code === "auth/weak-password") {
        setError("Password is too weak. Please use a stronger password.")
      } else {
        setError(error.message || "An error occurred during registration.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center text-gray-900 dark:text-white">Chat App</CardTitle>
          <CardDescription className="text-center text-gray-500 dark:text-gray-300">
            Sign in or create an account to start chatting
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isOnline && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>You are offline</AlertTitle>
              <AlertDescription>
                Please check your internet connection. The app requires an internet connection to function properly.
              </AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-700 dark:text-gray-300">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-gray-700 dark:text-gray-300">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700"
                  />
                </div>
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" className="w-full btn-primary" disabled={isLoading || !isOnline}>
                  {isLoading ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    "Login"
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-gray-700 dark:text-gray-300">
                    Username
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="johndoe"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email" className="text-gray-700 dark:text-gray-300">
                    Email
                  </Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="your@email.com"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    required
                    className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password" className="text-gray-700 dark:text-gray-300">
                    Password
                  </Label>
                  <Input
                    id="register-password"
                    type="password"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    required
                    className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700"
                  />
                </div>
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" className="w-full btn-primary" disabled={isLoading || !isOnline}>
                  {isLoading ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Register"
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-xs text-center text-gray-500 dark:text-gray-400">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
