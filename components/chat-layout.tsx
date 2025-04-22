"use client"

import { useState, useEffect } from "react"
import { useFirebase } from "@/components/firebase-provider"
import { db } from "@/lib/firebase"
import { ref, onValue, get, set, serverTimestamp, update } from "firebase/database"
import type { User, Chat } from "@/lib/types"
import Sidebar from "@/components/sidebar"
import ChatWindow from "@/components/chat-window"
import SettingsModal from "@/components/settings-modal"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import OnlinePresence from "@/components/online-presence"

export default function ChatLayout() {
  const { user } = useFirebase()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [chats, setChats] = useState<Chat[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [selectedChat, setSelectedChat] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [creatingUserData, setCreatingUserData] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const [isMigratingData, setIsMigratingData] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<Record<string, boolean>>({})
  const [isMobileView, setIsMobileView] = useState(false)
  const [showChatOnMobile, setShowChatOnMobile] = useState(false)

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileView(window.innerWidth < 768)
    }

    // Initial check
    checkMobile()

    // Add resize listener
    window.addEventListener("resize", checkMobile)

    return () => {
      window.removeEventListener("resize", checkMobile)
    }
  }, [])

  // When a chat is selected on mobile, show the chat view
  useEffect(() => {
    if (selectedChat && isMobileView) {
      setShowChatOnMobile(true)
    }
  }, [selectedChat, isMobileView])

  // Listen for presence changes
  useEffect(() => {
    if (!user) return

    const presenceRef = ref(db, "presence")

    const unsubscribe = onValue(presenceRef, (snapshot) => {
      if (snapshot.exists()) {
        const presenceData: Record<string, boolean> = {}

        snapshot.forEach((childSnapshot) => {
          const userId = childSnapshot.key || ""
          const userData = childSnapshot.val()

          presenceData[userId] = userData?.online || false
        })

        setOnlineUsers(presenceData)
      }
    })

    return () => unsubscribe()
  }, [user])

  // Fetch current user data
  useEffect(() => {
    if (!user) return

    const fetchCurrentUser = async () => {
      try {
        console.log("Fetching current user data for:", user.uid)
        // Get the user document from Realtime Database
        const userRef = ref(db, `users/${user.uid}`)
        const snapshot = await get(userRef)

        if (snapshot.exists()) {
          const userData = snapshot.val()
          console.log("User data found:", userData)

          // Ensure all required fields exist
          const defaultUsername = user.displayName || user.email?.split("@")[0] || `User_${user.uid.substring(0, 5)}`
          const defaultPhotoURL =
            user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(defaultUsername)}&background=random`

          // Update with any missing fields
          const updatedData: any = {}

          let needsUpdate = false

          if (!userData.username) {
            updatedData.username = defaultUsername
            needsUpdate = true
          }

          if (!userData.photoURL) {
            updatedData.photoURL = defaultPhotoURL
            needsUpdate = true
          }

          if (!userData.id) {
            updatedData.id = user.uid
            needsUpdate = true
          }

          if (!userData.email) {
            updatedData.email = user.email
            needsUpdate = true
          }

          if (!userData.createdAt) {
            updatedData.createdAt = serverTimestamp()
            needsUpdate = true
          }

          // Update if any fields were missing
          if (needsUpdate) {
            console.log("Updating user data with missing fields:", updatedData)
            await update(userRef, updatedData)
          }

          // Set current user with complete data
          setCurrentUser({
            id: user.uid,
            username: userData.username || defaultUsername,
            email: userData.email || user.email || "",
            photoURL: userData.photoURL || defaultPhotoURL,
            lastSeen: userData.lastSeen ? new Date(userData.lastSeen) : null,
            createdAt: userData.createdAt ? new Date(userData.createdAt) : new Date(),
            online: onlineUsers[user.uid] || false,
          })
        } else {
          console.log("No user data found, creating new profile")
          // User data doesn't exist, create it
          setCreatingUserData(true)

          // Create a default user profile
          const defaultUsername = user.displayName || user.email?.split("@")[0] || `User_${user.uid.substring(0, 5)}`
          const defaultPhotoURL =
            user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(defaultUsername)}&background=random`

          const defaultUserData = {
            id: user.uid,
            username: defaultUsername,
            email: user.email || "",
            photoURL: defaultPhotoURL,
            createdAt: serverTimestamp(),
          }

          // Save to database
          await set(userRef, defaultUserData)

          // Set current user
          setCurrentUser({
            ...defaultUserData,
            id: user.uid,
            lastSeen: null,
            createdAt: new Date(),
            online: true,
          })

          setCreatingUserData(false)
        }
      } catch (error: any) {
        console.error("Error fetching current user:", error)
        setError(`Failed to fetch user data: ${error.message}`)
        setDebugInfo(`User ID: ${user.uid}, Error: ${error.message}`)
      }
    }

    fetchCurrentUser()

    // Fetch all users with Realtime Database
    try {
      console.log("Setting up users listener")
      const usersRef = ref(db, "users")

      const unsubscribe = onValue(
        usersRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const usersData: User[] = []
            const incompleteUsers: { id: string; data: any }[] = []

            snapshot.forEach((childSnapshot) => {
              const userData = childSnapshot.val()
              const userId = childSnapshot.key || ""

              // Check if user data is complete
              if (userData && userData.username && userData.photoURL) {
                usersData.push({
                  ...userData,
                  id: userId,
                  lastSeen: userData.lastSeen ? new Date(userData.lastSeen) : null,
                  createdAt: userData.createdAt ? new Date(userData.createdAt) : new Date(),
                  online: onlineUsers[userId] || false,
                  email: userData.email || `user_${userId.substring(0, 5)}@example.com`,
                })
              } else if (userData) {
                // Add to incomplete users list for potential migration
                incompleteUsers.push({ id: userId, data: userData })
                console.log("Incomplete user data found:", userId, userData)
              }
            })

            console.log(`Found ${usersData.length} valid users and ${incompleteUsers.length} incomplete users`)

            // If we have incomplete users and we're not already migrating, start migration
            if (incompleteUsers.length > 0 && !isMigratingData && user) {
              migrateIncompleteUsers(incompleteUsers, user.uid)
            }

            setUsers(usersData)
            setIsLoading(false)

            const currentUserData = usersData.find((u) => u.id === user.uid)
            if (currentUserData) {
              setCurrentUser({
                ...currentUserData,
                online: onlineUsers[user.uid] || false,
              })
            }
          } else {
            console.log("No users found in database")
            setUsers([])
            setIsLoading(false)
          }
        },
        (error) => {
          console.error("Error fetching users:", error)

          if (error.code === "PERMISSION_DENIED") {
            setError("Permission denied. Please check Firebase security rules for the users collection.")
          } else {
            setError(`Failed to fetch users: ${error.message}`)
          }

          setIsLoading(false)
        },
      )

      return () => unsubscribe()
    } catch (error: any) {
      console.error("Error setting up users listener:", error)
      setError(`Failed to set up users listener: ${error.message}`)
      setIsLoading(false)
    }
  }, [user, retryCount, isMigratingData, onlineUsers])

  // Listen for messages from service worker
  useEffect(() => {
    if (!user) return

    const handleMessage = (event: MessageEvent) => {
      // Check if it's a message to open a specific chat
      if (event.data && event.data.type === "OPEN_CHAT") {
        const { chatId, senderId } = event.data

        if (chatId) {
          setSelectedChat(chatId)

          // Find the user
          const user = users.find((u) => u.id === senderId)
          if (user) {
            setSelectedUser({
              ...user,
              online: onlineUsers[senderId] || false,
            })
          }

          // For mobile, ensure we show the chat view
          if (isMobileView) {
            setShowChatOnMobile(true)
          }
        }
      }
    }

    navigator.serviceWorker.addEventListener("message", handleMessage)

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage)
    }
  }, [user, users, onlineUsers, isMobileView])

  // Function to migrate incomplete user data
  const migrateIncompleteUsers = async (incompleteUsers: { id: string; data: any }[], currentUserId: string) => {
    try {
      setIsMigratingData(true)
      console.log("Starting migration for incomplete users...")

      for (const { id, data } of incompleteUsers) {
        // Skip migration for other users if not the current user
        // This is to respect permissions - users can only update their own data
        if (id !== currentUserId) continue

        const userRef = ref(db, `users/${id}`)

        // Create default values for missing fields
        const defaultUsername = `User_${id.substring(0, 5)}`
        const defaultPhotoURL = `https://ui-avatars.com/api/?name=${encodeURIComponent(defaultUsername)}&background=random`

        const updatedData: any = {
          ...data,
          id: id,
        }

        if (!data.username) updatedData.username = defaultUsername
        if (!data.photoURL) updatedData.photoURL = defaultPhotoURL
        if (!data.email) updatedData.email = `user_${id.substring(0, 5)}@example.com`
        if (!data.createdAt) updatedData.createdAt = serverTimestamp()

        console.log(`Migrating user ${id} with data:`, updatedData)

        try {
          await update(userRef, updatedData)
          console.log(`Successfully migrated user ${id}`)
        } catch (error) {
          console.error(`Failed to migrate user ${id}:`, error)
        }
      }
    } catch (error) {
      console.error("Error during user data migration:", error)
    } finally {
      setIsMigratingData(false)
    }
  }

  // Fetch chats for current user with Realtime Database
  useEffect(() => {
    if (!user?.uid) return

    try {
      console.log("Setting up chats listener")
      const chatsRef = ref(db, "chats")

      const unsubscribe = onValue(
        chatsRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const chatsData: Chat[] = []

            snapshot.forEach((childSnapshot) => {
              const chatData = childSnapshot.val()

              // Only include chats where the current user is a participant
              if (chatData.participants && chatData.participants.includes(user.uid)) {
                chatsData.push({
                  id: childSnapshot.key || "",
                  ...chatData,
                  createdAt: chatData.createdAt ? new Date(chatData.createdAt) : new Date(),
                  updatedAt: chatData.updatedAt ? new Date(chatData.updatedAt) : new Date(),
                  lastMessage: chatData.lastMessage
                    ? {
                        ...chatData.lastMessage,
                        timestamp: chatData.lastMessage.timestamp
                          ? new Date(chatData.lastMessage.timestamp)
                          : new Date(),
                      }
                    : undefined,
                })
              }
            })

            // Sort chats by updatedAt in descending order
            chatsData.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

            console.log(`Found ${chatsData.length} chats for current user`)
            setChats(chatsData)
          } else {
            console.log("No chats found")
            setChats([])
          }
        },
        (error) => {
          console.error("Error fetching chats:", error)

          if (error.code === "PERMISSION_DENIED") {
            setError("Permission denied. Please check Firebase security rules for the chats collection.")
          } else {
            setError(`Failed to fetch chats: ${error.message}`)
          }
        },
      )

      return () => unsubscribe()
    } catch (error: any) {
      console.error("Error setting up chats listener:", error)
      setError(`Failed to set up chat listener: ${error.message}`)
    }
  }, [user, retryCount])

  const handleChatSelect = (chatId: string, userId: string) => {
    setSelectedChat(chatId)
    const user = users.find((u) => u.id === userId)
    if (user) {
      setSelectedUser({
        ...user,
        online: onlineUsers[userId] || false,
      })
    }

    // For mobile, ensure we show the chat view
    if (isMobileView) {
      setShowChatOnMobile(true)
    }
  }

  // Handle back button on mobile
  const handleBackToSidebar = () => {
    setShowChatOnMobile(false)
    // We need to temporarily clear the selectedChat so that clicking the same chat again will work
    // We'll use setTimeout to ensure the UI transition happens first
    setTimeout(() => {
      setSelectedChat(null)
    }, 50)
  }

  // Improved search functionality
  const filteredUsers = searchQuery
    ? users.filter((u) => {
        if (!user) return false
        return u.id !== user.uid && u.username && u.username.toLowerCase().includes(searchQuery.toLowerCase())
      })
    : []

  const handleRetry = () => {
    setError(null)
    setDebugInfo(null)
    setIsLoading(true)
    setRetryCount((prev) => prev + 1)
  }

  if (isLoading || creatingUserData || isMigratingData) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">
            {creatingUserData
              ? "Creating your profile..."
              : isMigratingData
                ? "Updating user data..."
                : "Loading your chats..."}
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center p-6 max-w-md">
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Connection Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          {debugInfo && (
            <div className="mb-4 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs text-left overflow-auto">
              <pre>{debugInfo}</pre>
            </div>
          )}
          <p className="mb-4 text-gray-600 dark:text-gray-300">
            This may be due to network issues, incorrect Firebase configuration, or Firebase security rules.
          </p>
          <Button onClick={handleRetry} className="mr-2">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload Page
          </Button>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      {/* Include the OnlinePresence component */}
      <OnlinePresence />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - hide on mobile when chat is open */}
        <div className={`${isMobileView && showChatOnMobile ? "hidden" : "flex flex-1 md:flex-none"}`}>
          <Sidebar
            currentUser={currentUser}
            chats={chats}
            users={users}
            selectedChat={selectedChat}
            onChatSelect={handleChatSelect}
            onSettingsOpen={() => setIsSettingsOpen(true)}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filteredUsers={filteredUsers}
          />
        </div>

        {/* Chat Window - show on mobile only when a chat is selected */}
        <div className={`${isMobileView && !showChatOnMobile ? "hidden" : "flex flex-1"}`}>
          <ChatWindow
            currentUser={currentUser}
            selectedChat={selectedChat}
            selectedUser={selectedUser}
            users={users}
            setSelectedChat={setSelectedChat}
            isMobileView={isMobileView}
            onBackClick={handleBackToSidebar}
          />
        </div>
      </div>

      {isSettingsOpen && currentUser && (
        <SettingsModal user={currentUser} isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      )}
    </div>
  )
}
