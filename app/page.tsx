"use client"
import { useRouter } from "next/navigation"
import { useFirebase } from "@/components/firebase-provider"
import AuthScreen from "@/components/auth-screen"
import ChatLayout from "@/components/chat-layout"
import IOSInstallPrompt from "@/components/ios-install-prompt"

export default function Home() {
  const { user, loading } = useFirebase()
  const router = useRouter()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <main className="h-screen">
      {user ? <ChatLayout /> : <AuthScreen />}
      <IOSInstallPrompt />
    </main>
  )
}
