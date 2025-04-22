"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import type { User, Message } from "@/lib/types"
import { formatDistanceToNow } from "date-fns"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Paperclip, Send, Trash2, RefreshCw, Smile, Heart, ArrowLeft } from "lucide-react"
import { db, storage } from "@/lib/firebase"
import { ref as dbRef, onValue, push, set, update, remove, serverTimestamp, get } from "firebase/database"
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Alert, AlertDescription } from "@/components/ui/alert"
import dynamic from "next/dynamic"
import { isIOS, isPWAInstalled, sendPushFooNotification } from "@/lib/push-foo"

// Dynamically import the emoji picker to avoid SSR issues
const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false })

interface ChatWindowProps {
  currentUser: User | null
  selectedChat: string | null
  selectedUser: User | null
  users: User[]
  setSelectedChat: React.Dispatch<React.SetStateAction<string | null>>
  isMobileView?: boolean
  onBackClick?: () => void
}

export default function ChatWindow({
  currentUser,
  selectedChat,
  selectedUser,
  users,
  setSelectedChat,
  isMobileView = false,
  onBackClick,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [messagesError, setMessagesError] = useState<string | null>(null)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isIOSPWA, setIsIOSPWA] = useState(false)

  useEffect(() => {
    // Check if this is an iOS PWA
    setIsIOSPWA(isIOS() && isPWAInstalled())
  }, [])

  // Fetch messages for selected chat
  useEffect(() => {
    if (!selectedChat) {
      setMessages([])
      return
    }

    setMessagesError(null)
    setIsLoadingMessages(true)

    try {
      const messagesRef = dbRef(db, `chats/${selectedChat}/messages`)

      const unsubscribe = onValue(
        messagesRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const messagesData: Message[] = []

            snapshot.forEach((childSnapshot) => {
              const messageData = childSnapshot.val()
              messagesData.push({
                id: childSnapshot.key || "",
                ...messageData,
                timestamp: messageData.timestamp ? new Date(messageData.timestamp) : new Date(),
                reactions: messageData.reactions || {},
              })
            })

            // Sort messages by timestamp
            messagesData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

            setMessages(messagesData)
            setIsLoadingMessages(false)

            // Mark messages as read
            if (currentUser) {
              messagesData.forEach((message) => {
                if (message.receiverId === currentUser.id && !message.read) {
                  const messageRef = dbRef(db, `chats/${selectedChat}/messages/${message.id}`)
                  update(messageRef, { read: true }).catch((err) =>
                    console.error("Error marking message as read:", err),
                  )
                }
              })
            }
          } else {
            setMessages([])
            setIsLoadingMessages(false)
          }
        },
        (error) => {
          console.error("Error fetching messages:", error)
          setMessagesError(`Failed to load messages: ${error.message}`)
          setIsLoadingMessages(false)
        },
      )

      return () => unsubscribe()
    } catch (error: any) {
      console.error("Error setting up messages listener:", error)
      setMessagesError(`Failed to set up messages listener: ${error.message}`)
      setIsLoadingMessages(false)
    }
  }, [selectedChat, currentUser])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Function to send push notifications
  const sendPushNotification = async (message: string) => {
    if (!currentUser || !selectedUser) return

    try {
      // For iOS PWA, use push.foo
      if (isIOSPWA) {
        await sendPushFooNotification(selectedUser.id, `New message from ${currentUser.username}`, message, {
          chatId: selectedChat,
          senderId: currentUser.id,
        })
        return
      }

      // For other platforms, use standard Web Push API
      const userRef = dbRef(db, `users/${selectedUser.id}`)
      const userSnapshot = await get(userRef)

      if (userSnapshot.exists()) {
        const userData = userSnapshot.val()
        const pushSubscription = userData.pushSubscription

        if (pushSubscription) {
          // Send push notification
          await fetch("/api/push-notification", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              subscription: pushSubscription,
              userId: selectedUser.id,
              senderId: currentUser.id,
              message: message,
              chatId: selectedChat,
              title: `New message from ${currentUser.username}`,
            }),
          })
        }
      }
    } catch (error) {
      console.error("Error sending push notification:", error)
      // Don't block the UI for push notification errors
    }
  }

  const handleSendMessage = async () => {
    if (!currentUser || !selectedChat || !selectedUser || !newMessage.trim()) return

    try {
      // Create a new message in the Realtime Database
      const messagesRef = dbRef(db, `chats/${selectedChat}/messages`)
      const newMessageRef = push(messagesRef)

      const messageData = {
        text: newMessage,
        senderId: currentUser.id,
        receiverId: selectedUser.id,
        timestamp: serverTimestamp(),
        read: false,
        reactions: {},
      }

      await set(newMessageRef, messageData)

      // Update last message in chat
      const chatRef = dbRef(db, `chats/${selectedChat}`)
      await update(chatRef, {
        lastMessage: {
          id: newMessageRef.key,
          text: newMessage,
          senderId: currentUser.id,
          receiverId: selectedUser.id,
          timestamp: new Date().toISOString(),
          read: false,
        },
        updatedAt: serverTimestamp(),
      })

      // Send push notification
      await sendPushNotification(newMessage)

      setNewMessage("")
      setShowEmojiPicker(false)
    } catch (error: any) {
      console.error("Error sending message:", error)
      alert(`Failed to send message: ${error.message}`)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentUser || !selectedChat || !selectedUser) return

    setIsUploading(true)
    setUploadProgress(0)

    const fileType = file.type.startsWith("image/") ? "images" : "videos"
    const fileRef = storageRef(storage, `${fileType}/${selectedChat}/${Date.now()}_${file.name}`)

    const uploadTask = uploadBytesResumable(fileRef, file)

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        setUploadProgress(progress)
      },
      (error) => {
        console.error("Error uploading file:", error)
        alert(`Failed to upload file: ${error.message}`)
        setIsUploading(false)
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)

        try {
          const isImage = file.type.startsWith("image/")

          // Create a new message with the file URL
          const messagesRef = dbRef(db, `chats/${selectedChat}/messages`)
          const newMessageRef = push(messagesRef)

          const messageData = {
            text: isImage ? null : "Sent a video",
            senderId: currentUser.id,
            receiverId: selectedUser.id,
            timestamp: serverTimestamp(),
            read: false,
            reactions: {},
            ...(isImage ? { imageUrl: downloadURL } : { videoUrl: downloadURL }),
          }

          await set(newMessageRef, messageData)

          // Update last message in chat
          const chatRef = dbRef(db, `chats/${selectedChat}`)
          await update(chatRef, {
            lastMessage: {
              id: newMessageRef.key,
              text: isImage ? null : "Sent a video",
              senderId: currentUser.id,
              receiverId: selectedUser.id,
              timestamp: new Date().toISOString(),
              read: false,
              ...(isImage ? { imageUrl: downloadURL } : { videoUrl: downloadURL }),
            },
            updatedAt: serverTimestamp(),
          })

          // Send push notification for image/video
          const notificationMessage = isImage ? "Sent you an image" : "Sent you a video"
          await sendPushNotification(notificationMessage)

          setIsUploading(false)
        } catch (error: any) {
          console.error("Error sending file message:", error)
          alert(`Failed to send file message: ${error.message}`)
          setIsUploading(false)
        }
      },
    )
  }

  const handleDeleteChat = async () => {
    if (!selectedChat || !window.confirm("Are you sure you want to delete this chat?")) return

    try {
      // Delete the chat document in Realtime Database
      const chatRef = dbRef(db, `chats/${selectedChat}`)
      await remove(chatRef)

      // Clear selected chat
      setSelectedChat(null)

      // Go back to sidebar on mobile
      if (isMobileView && onBackClick) {
        onBackClick()
      }
    } catch (error: any) {
      console.error("Error deleting chat:", error)
      alert(`Failed to delete chat: ${error.message}`)
    }
  }

  const handleEmojiClick = (emojiData: any) => {
    setNewMessage((prev) => prev + emojiData.emoji)
  }

  const handleAddReaction = async (messageId: string) => {
    if (!currentUser || !selectedChat) return

    try {
      const messageRef = dbRef(db, `chats/${selectedChat}/messages/${messageId}/reactions/${currentUser.id}`)
      await set(messageRef, "❤️")
    } catch (error) {
      console.error("Error adding reaction:", error)
    }
  }

  // Check if the current user has reacted to a message
  const hasUserReacted = (message: Message) => {
    return currentUser && message.reactions && message.reactions[currentUser.id] === "❤️"
  }

  if (!selectedChat || !selectedUser) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Select a chat to start messaging</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
            Or search for a user to start a new conversation
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-900">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-900">
        <div className="flex items-center space-x-3">
          {/* Back button for mobile */}
          {isMobileView && onBackClick && (
            <Button variant="ghost" size="icon" onClick={onBackClick} className="mr-1">
              <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            </Button>
          )}

          {selectedUser.photoURL && (
            <Image
              src={selectedUser.photoURL || "/placeholder.svg"}
              alt={selectedUser.username}
              width={40}
              height={40}
              className="user-avatar"
            />
          )}
          <div>
            <h2 className="font-medium text-gray-900 dark:text-white">{selectedUser.username}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {selectedUser.online ? (
                <span className="text-green-500">Online</span>
              ) : selectedUser.lastSeen ? (
                `Last seen ${formatDistanceToNow(new Date(selectedUser.lastSeen), {
                  addSuffix: true,
                })}`
              ) : (
                "Offline"
              )}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDeleteChat}
          className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto bg-gray-50 dark:bg-gray-800">
        {messagesError ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Alert variant="destructive" className="mb-4 max-w-md">
              <AlertDescription>{messagesError}</AlertDescription>
            </Alert>
            <Button
              onClick={() => {
                // Force refresh the messages
                setMessagesError(null)
                // This will trigger the useEffect again
                const chatId = selectedChat
                setSelectedChat(null)
                setTimeout(() => setSelectedChat(chatId), 100)
              }}
              className="mt-2 btn-primary"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : isLoadingMessages ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 dark:text-gray-300">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => {
            const isCurrentUser = message.senderId === currentUser?.id
            const reactionCount = message.reactions ? Object.keys(message.reactions).length : 0
            const userHasReacted = hasUserReacted(message)

            return (
              <div key={message.id} className={`mb-4 flex ${isCurrentUser ? "justify-end" : "justify-start"}`}>
                <div
                  className={`message-bubble p-3 rounded-2xl ${
                    isCurrentUser ? "bg-blue-500 text-white" : "bg-gray-200 dark:bg-gray-700 dark:text-gray-100"
                  }`}
                  onDoubleClick={() => handleAddReaction(message.id)}
                >
                  {message.imageUrl && (
                    <div className="mb-2">
                      <Image
                        src={message.imageUrl || "/placeholder.svg"}
                        alt="Image"
                        width={300}
                        height={200}
                        className="message-image"
                      />
                    </div>
                  )}

                  {message.videoUrl && (
                    <div className="mb-2">
                      <video src={message.videoUrl} controls className="message-image" />
                    </div>
                  )}

                  {message.text && <p>{message.text}</p>}

                  <div
                    className={`text-xs mt-1 flex items-center justify-between ${
                      isCurrentUser ? "text-blue-100" : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    <span>
                      {message.timestamp && (
                        <span>
                          {new Date(message.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                      {isCurrentUser && <span className="ml-2">{message.read ? "✓✓" : "✓"}</span>}
                    </span>

                    {reactionCount > 0 && (
                      <span className="ml-2 flex items-center">
                        <Heart
                          className={`h-3 w-3 mr-1 ${userHasReacted ? "text-red-500 fill-red-500" : "fill-current"}`}
                        />
                        {reactionCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        {isUploading && (
          <div className="mb-2">
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
              <div className="h-2 bg-blue-500 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Uploading... {Math.round(uploadProgress)}%</p>
          </div>
        )}

        <div className="relative">
          {showEmojiPicker && (
            <div className="absolute bottom-full mb-2">
              <EmojiPicker onEmojiClick={handleEmojiClick} />
            </div>
          )}

          <div className="flex items-end space-x-2">
            <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
              <Paperclip className="h-5 w-5" />
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*,video/*"
                className="hidden"
              />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              disabled={isUploading}
            >
              <Smile className="h-5 w-5" />
            </Button>

            <Textarea
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 message-input rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700"
              rows={1}
              disabled={isUploading}
            />

            <Button onClick={handleSendMessage} disabled={!newMessage.trim() || isUploading} className="btn-primary">
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
