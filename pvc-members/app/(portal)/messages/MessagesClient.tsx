"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Avatar } from "@/components/ui/Avatar"
import { formatRelativeTime } from "@/lib/utils"
import type { User, Message } from "@prisma/client"
import { Send } from "lucide-react"

type Conversation = {
  partner: User
  lastMessage: Message & { sender: User; receiver: User }
  unreadCount: number
}

type Props = {
  userId: string
  conversations: Conversation[]
  members: User[]
  activePartner: User | null
  activeMessages: (Message & { sender: User; receiver: User })[]
}

export function MessagesClient({
  userId,
  conversations,
  members,
  activePartner: initialPartner,
  activeMessages: initialMessages,
}: Props) {
  const [activePartner, setActivePartner] = useState<User | null>(initialPartner)
  const [messages, setMessages] = useState(initialMessages)
  const [text, setText] = useState("")
  const [isPending, startTransition] = useTransition()
  const [newChat, setNewChat] = useState(false)
  const [search, setSearch] = useState("")
  const router = useRouter()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Poll for new messages every 10s when a thread is open
  useEffect(() => {
    if (!activePartner) return
    const interval = setInterval(() => router.refresh(), 10_000)
    return () => clearInterval(interval)
  }, [activePartner, router])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !activePartner) return
    const content = text.trim()
    setText("")
    startTransition(async () => {
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: activePartner.id, content }),
      })
      router.refresh()
    })
  }

  const [mobileView, setMobileView] = useState<"list" | "thread">(initialPartner ? "thread" : "list")

  const filtered = members.filter((m) =>
    !search || m.name?.toLowerCase().includes(search.toLowerCase()) || m.email.includes(search.toLowerCase())
  )

  function selectPartner(partner: User) {
    setActivePartner(partner)
    setMobileView("thread")
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Conversation list */}
      <div
        className={mobileView === "list" ? "msg-panel-visible" : "msg-panel-hidden"}
        style={{
          width: 280,
          borderRight: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-surface)",
          flexShrink: 0,
        }}
      >
        <div style={{ padding: "16px", borderBottom: "1px solid var(--border-subtle)" }}>
          <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
            Messages
          </h2>
          <button
            onClick={() => setNewChat(!newChat)}
            style={{
              width: "100%",
              padding: "8px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-secondary)",
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "Plus Jakarta Sans, sans-serif",
            }}
          >
            + New conversation
          </button>
          {newChat && (
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members..."
              autoFocus
              style={{
                width: "100%",
                marginTop: 8,
                padding: "7px 10px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-primary)",
                fontSize: 13,
                outline: "none",
                fontFamily: "Plus Jakarta Sans, sans-serif",
              }}
            />
          )}
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          {newChat && search
            ? filtered.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    selectPartner(m)
                    setMessages([])
                    setNewChat(false)
                    setSearch("")
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 16px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  <Avatar src={m.avatar} name={m.name} size={32} role={m.role} />
                  <span style={{ fontSize: 14, color: "var(--text-primary)" }}>
                    {m.name ?? m.email.split("@")[0]}
                  </span>
                </button>
              ))
            : conversations.map(({ partner, lastMessage, unreadCount }) => (
                <button
                  key={partner.id}
                  onClick={() => selectPartner(partner)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 16px",
                    background: activePartner?.id === partner.id ? "var(--bg-hover)" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    borderBottom: "1px solid var(--border-subtle)",
                    transition: "background 0.1s",
                  }}
                >
                  <Avatar src={partner.avatar} name={partner.name} size={36} role={partner.role} online={partner.isOnline} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                      <span style={{ fontSize: 14, fontWeight: unreadCount > 0 ? 600 : 400, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {partner.name ?? partner.email.split("@")[0]}
                      </span>
                      {unreadCount > 0 && (
                        <span style={{ background: "var(--accent)", color: "#000", borderRadius: "var(--radius-full)", fontSize: 11, fontWeight: 700, padding: "1px 6px", flexShrink: 0 }}>
                          {unreadCount}
                        </span>
                      )}
                    </div>
                    {lastMessage && (
                      <span style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                        {lastMessage.senderId === userId ? "You: " : ""}{lastMessage.content}
                      </span>
                    )}
                  </div>
                </button>
              ))}
        </div>
      </div>

      {/* Chat area */}
      <div
        className={mobileView === "thread" ? "msg-panel-visible" : "msg-panel-hidden"}
        style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}
      >
        {activePartner ? (
          <>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 12 }}>
              {/* Back button — mobile only */}
              <button
                className="msg-back-btn"
                onClick={() => setMobileView("list")}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px 8px 4px 0", display: "none", flexShrink: 0 }}
              >
                ←
              </button>
              <Avatar src={activePartner.avatar} name={activePartner.name} size={36} role={activePartner.role} online={activePartner.isOnline} />
              <div>
                <Link href={`/members/${activePartner.id}`} style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", textDecoration: "none" }}>
                  {activePartner.name ?? activePartner.email.split("@")[0]}
                </Link>
                <div style={{ fontSize: 12, color: activePartner.isOnline ? "var(--success)" : "var(--text-muted)" }}>
                  {activePartner.isOnline ? "Online" : "Offline"}
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: "20px" }}>
              {messages.length === 0 && (
                <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 14, marginTop: 40 }}>
                  No messages yet. Say something.
                </div>
              )}
              {messages.map((m) => {
                const mine = m.senderId === userId
                return (
                  <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 12 }}>
                    {!mine && <div style={{ marginRight: 8, flexShrink: 0 }}><Avatar src={m.sender.avatar} name={m.sender.name} size={28} /></div>}
                    <div style={{ maxWidth: "70%" }}>
                      <div
                        style={{
                          padding: "9px 14px",
                          background: mine ? "var(--accent)" : "var(--bg-elevated)",
                          color: mine ? "#000" : "var(--text-primary)",
                          borderRadius: mine ? "var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg)" : "var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--radius-sm)",
                          fontSize: 14,
                          lineHeight: 1.5,
                        }}
                      >
                        {m.content}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3, textAlign: mine ? "right" : "left" }}>
                        {formatRelativeTime(m.createdAt)}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            <form
              onSubmit={sendMessage}
              style={{ padding: "12px 20px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 10 }}
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Message ${activePartner.name ?? activePartner.email.split("@")[0]}...`}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-full)",
                  color: "var(--text-primary)",
                  fontSize: 16,
                  outline: "none",
                  fontFamily: "Plus Jakarta Sans, sans-serif",
                }}
              />
              <button
                type="submit"
                disabled={!text.trim() || isPending}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: text.trim() ? "var(--accent)" : "var(--bg-elevated)",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: text.trim() ? "pointer" : "not-allowed",
                  flexShrink: 0,
                }}
              >
                <Send size={15} style={{ color: text.trim() ? "#000" : "var(--text-muted)" }} />
              </button>
            </form>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "var(--text-muted)" }}>
            <div style={{ fontSize: 36 }}>💬</div>
            <p>Select a conversation or start a new one</p>
          </div>
        )}
      </div>
    </div>
  )
}
