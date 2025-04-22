"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import type { User, Chat } from "@/lib/types"
import { formatDistanceToNow } from "date-fns"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Settings, LogOut } from "lucide-react"
import { auth, db } from "@/lib/firebase"
import { signOut } from "firebase/auth"
import { ref, push, set, serverTimestamp, onValue } from "firebase/database"
import NetworkStatus from "@/components/network-status"

interface SidebarProps {
  currentUser: User | null
  chats: Chat[]
  users: User[]
  selectedChat: string | null
  onChatSelect: (chatId: string, userId: string) => void
  onSettingsOpen: () => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  filteredUsers: User[]
}

export default function Sidebar({
  currentUser,
  chats,
  users,
  selectedChat,
  onChatSelect,
  onSettingsOpen,
  searchQuery,
  setSearchQuery,
  filteredUsers,
}: SidebarProps) {
  const [isSearching, setIsSearching] = useState(false)
  const [debugMode, setDebugMode] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<Record<string, boolean>>({})

  // Enable debug mode with 5 clicks on the header
  const [clickCount, setClickCount] = useState(0)
  const handleHeaderClick = () => {
    setClickCount((prev) => {
      const newCount = prev + 1
      if (newCount >= 5) {
        setDebugMode(true)
        return 0
      }
      return newCount
    })
  }

  // Listen for presence changes
  useEffect(() => {
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
  }, [])

  useEffect(() => {
    // Log current user data for debugging
    if (debugMode && currentUser) {
      console.log("Current user data:", currentUser)
      console.log("All users:", users)
      console.log("Online users:", onlineUsers)
    }
  }, [debugMode, currentUser, users, onlineUsers])

  const handleLogout = async () => {
    try {
      await signOut(auth)
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  const startNewChat = async (userId: string) => {
    if (!currentUser) return

    try {
      // Check if chat already exists
      const existingChat = chats.find(
        (chat) =>
          chat.participants.includes(userId) &&
          chat.participants.length === 2 &&
          chat.participants.includes(currentUser.id),
      )

      if (existingChat) {
        onChatSelect(existingChat.id, userId)
        setSearchQuery("")
        setIsSearching(false)
        return
      }

      // Create new chat in Realtime Database
      const chatsRef = ref(db, "chats")
      const newChatRef = push(chatsRef)

      await set(newChatRef, {
        participants: [currentUser.id, userId],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      onChatSelect(newChatRef.key || "", userId)
      setSearchQuery("")
      setIsSearching(false)
    } catch (error: any) {
      console.error("Error creating new chat:", error)
      alert("Failed to create new chat. Please check your connection.")
    }
  }

  const getChatName = (chat: Chat) => {
    if (!currentUser) return ""

    const otherParticipantId = chat.participants.find((p) => p !== currentUser.id)

    if (!otherParticipantId) return ""

    const otherUser = users.find((u) => u.id === otherParticipantId)
    return otherUser?.username || "Unknown User"
  }

  const getChatAvatar = (chat: Chat) => {
    if (!currentUser) return ""

    const otherParticipantId = chat.participants.find((p) => p !== currentUser.id)

    if (!otherParticipantId) return ""

    const otherUser = users.find((u) => u.id === otherParticipantId)
    return otherUser?.photoURL || ""
  }

  const getLastMessage = (chat: Chat) => {
    if (!chat.lastMessage) return ""

    if (chat.lastMessage.imageUrl) {
      return "📷 Image"
    }

    if (chat.lastMessage.videoUrl) {
      return "🎥 Video"
    }

    return chat.lastMessage.text || ""
  }

  // Check if a user is online using the presence data
  const isUserOnline = (userId: string) => {
    return onlineUsers[userId] || false
  }

  // Ensure currentUser has required fields
  const hasValidUserData = currentUser && currentUser.username && currentUser.photoURL

  return (
    <div className="w-full md:w-80 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-900 h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col" onClick={handleHeaderClick}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            {hasValidUserData ? (
              <>
                <Image
                  src={currentUser.photoURL || "/placeholder.svg"}
                  alt={currentUser.username}
                  width={40}
                  height={40}
                  className="user-avatar"
                />
                <span className="font-medium text-gray-900 dark:text-gray-100">{currentUser.username}</span>
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </div>
            )}
          </div>
          <div className="flex space-x-2">
            <Button variant="ghost" size="icon" onClick={onSettingsOpen}>
              <Settings className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            </Button>
          </div>
        </div>
        <NetworkStatus />

        {debugMode && currentUser && (
          <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto">
            <p>User ID: {currentUser.id}</p>
            <p>Username: {currentUser.username || "Missing"}</p>
            <p>Photo URL: {currentUser.photoURL ? "✓" : "Missing"}</p>
            <p>Total users: {users.length}</p>
            <p>Online: {isUserOnline(currentUser.id) ? "Yes" : "No"}</p>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="relative">
          <Input
            placeholder="Search users"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearching(true)}
            className="pl-8 bg-white dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700"
          />
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400 dark:text-gray-500" />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1.5 h-6 w-6 p-0"
              onClick={() => {
                setSearchQuery("")
                setIsSearching(false)
              }}
            >
              ×
            </Button>
          )}
        </div>
      </div>

      {/* Chat List or Search Results */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
        {isSearching && searchQuery ? (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  onClick={() => startNewChat(user.id)}
                >
                  <div className="flex items-center space-x-3">
                    {user.photoURL && (
                      <div className="relative">
                        <Image
                          src={user.photoURL || "/placeholder.svg"}
                          alt={user.username || "User"}
                          width={32}
                          height={32}
                          className="sidebar-avatar"
                        />
                        {isUserOnline(user.id) && (
                          <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></span>
                        )}
                      </div>
                    )}
                    <div>
                      <p className="font-medium dark:text-gray-100">{user.username}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-300">
                        {isUserOnline(user.id) ? (
                          <span className="text-green-500">Online</span>
                        ) : user.lastSeen ? (
                          `Last seen ${formatDistanceToNow(new Date(user.lastSeen), {
                            addSuffix: true,
                          })}`
                        ) : (
                          "Offline"
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">No users found</div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {chats.map((chat) => {
              const otherParticipantId = chat.participants.find((p) => p !== currentUser?.id)

              if (!otherParticipantId) return null

              const otherUser = users.find((u) => u.id === otherParticipantId)

              return (
                <div
                  key={chat.id}
                  className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${
                    selectedChat === chat.id ? "bg-gray-100 dark:bg-gray-800" : ""
                  }`}
                  onClick={() => onChatSelect(chat.id, otherParticipantId)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      {getChatAvatar(chat) ? (
                        <Image
                          src={getChatAvatar(chat) || "/placeholder.svg"}
                          alt={getChatName(chat)}
                          width={32}
                          height={32}
                          className="sidebar-avatar"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                      )}
                      {otherUser && isUserOnline(otherUser.id) && (
                        <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between">
                        <p className="font-medium truncate dark:text-gray-100">{getChatName(chat)}</p>
                        {chat.lastMessage && (
                          <p className="text-xs text-gray-500 dark:text-gray-300">
                            {formatDistanceToNow(new Date(chat.lastMessage.timestamp), {
                              addSuffix: true,
                            })}
                          </p>
                        )}
                      </div>
                      <div className="flex justify-between">
                        <p className="text-sm text-gray-500 dark:text-gray-300 truncate">{getLastMessage(chat)}</p>
                        {chat.lastMessage &&
                          !chat.lastMessage.read &&
                          chat.lastMessage.senderId !== currentUser?.id && (
                            <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                          )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            {chats.length === 0 && (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                No chats yet. Search for users to start chatting.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
