import type { User, Post, Comment, Reaction, Space, Event, Message } from "@prisma/client"

export type UserWithMeta = User & {
  _count?: {
    posts: number
    eventRSVPs: number
  }
}

export type PostWithAll = Post & {
  author: User
  space: Space | null
  comments: (Comment & { author: User })[]
  reactions: (Reaction & { user: User })[]
  _count: { comments: number; reactions: number }
}

export type EventWithRSVPs = Event & {
  rsvps: { userId: string; user: User }[]
  _count: { rsvps: number }
}

export type MessageWithUsers = Message & {
  sender: User
  receiver: User
}

export type Conversation = {
  partner: User
  lastMessage: Message
  unreadCount: number
}
