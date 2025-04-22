export interface User {
  id: string
  username: string
  email: string
  photoURL: string
  lastSeen: Date | null
  createdAt: Date
  online?: boolean
}

export interface Message {
  id: string
  text: string | null
  senderId: string
  receiverId: string
  timestamp: Date
  read: boolean
  imageUrl?: string
  videoUrl?: string
  reactions?: Record<string, string>
}

export interface Chat {
  id: string
  participants: string[]
  lastMessage?: Message
  createdAt: Date
  updatedAt: Date
}
