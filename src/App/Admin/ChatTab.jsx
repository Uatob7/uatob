// src/App/Admin/AdminChat.js
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Send,
  MessageCircle,
  Search,
  CheckCheck,
  Clock,
  User,
  Mail,
  Star,
  ChevronRight,
  Phone,
  AlertCircle,
  Check,
  Filter,
  MoreVertical,
  Reply,
  Copy,
  Trash2,
  Flag
} from "lucide-react";
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  getDoc,
  limit,
  writeBatch
} from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const styles = {
  container: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    background: "#F9FAFB",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
  },
  header: {
    background: "#FFFFFF",
    borderBottom: "1px solid #E5E7EB",
    padding: "16px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 16
  },
  backButton: {
    border: "none",
    background: "#F3F4F6",
    borderRadius: 8,
    width: 36,
    height: 36,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontSize: 18,
    transition: "all 0.2s"
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: "#111827"
  },
  stats: {
    display: "flex",
    gap: 16,
    alignItems: "center"
  },
  statBadge: {
    background: "#EFF6FF",
    padding: "6px 12px",
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 500,
    color: "#2563EB",
    display: "flex",
    alignItems: "center",
    gap: 6
  },
  body: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
    gap: 1,
    background: "#E5E7EB"
  },
  sidebar: {
    width: 360,
    background: "#FFFFFF",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden"
  },
  searchBar: {
    padding: 16,
    borderBottom: "1px solid #E5E7EB"
  },
  searchInput: {
    width: "100%",
    padding: "10px 36px 10px 12px",
    borderRadius: 10,
    border: "1px solid #E5E7EB",
    fontSize: 14,
    background: "#F9FAFB",
    outline: "none"
  },
  filterBar: {
    padding: "12px 16px",
    borderBottom: "1px solid #E5E7EB",
    display: "flex",
    gap: 8,
    flexWrap: "wrap"
  },
  filterChip: {
    padding: "6px 12px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s"
  },
  convList: {
    flex: 1,
    overflowY: "auto"
  },
  convItem: {
    padding: 16,
    borderBottom: "1px solid #F3F4F6",
    cursor: "pointer",
    transition: "all 0.2s",
    position: "relative"
  },
  convHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6
  },
  convName: {
    fontWeight: 600,
    fontSize: 14,
    color: "#111827"
  },
  convTime: {
    fontSize: 11,
    color: "#9CA3AF"
  },
  convPreview: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 8,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  },
  convMeta: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 11
  },
  unreadBadge: {
    background: "#DC2626",
    color: "white",
    borderRadius: 12,
    padding: "2px 8px",
    fontSize: 11,
    fontWeight: 600
  },
  chatArea: {
    flex: 1,
    background: "#FFFFFF",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden"
  },
  chatHeader: {
    padding: "16px 24px",
    borderBottom: "1px solid #E5E7EB",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#FFFFFF"
  },
  driverInfo: {
    display: "flex",
    alignItems: "center",
    gap: 12
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #EFF6FF, #DBEAFE)",
    border: "2px solid #BFDBFE",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 600,
    fontSize: 18,
    color: "#2563EB"
  },
  driverDetails: {
    display: "flex",
    flexDirection: "column",
    gap: 4
  },
  driverName: {
    fontWeight: 700,
    fontSize: 16,
    color: "#111827"
  },
  driverRating: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    color: "#6B7280"
  },
  actionButtons: {
    display: "flex",
    gap: 8
  },
  actionBtn: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #E5E7EB",
    background: "#FFFFFF",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    gap: 6,
    transition: "all 0.2s"
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    background: "#F9FAFB"
  },
  messageGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 4
  },
  messageBubble: {
    maxWidth: "65%",
    padding: "10px 14px",
    borderRadius: 12,
    fontSize: 14,
    lineHeight: 1.5,
    position: "relative"
  },
  messageOutgoing: {
    background: "#2563EB",
    color: "white",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4
  },
  messageIncoming: {
    background: "#FFFFFF",
    color: "#111827",
    border: "1px solid #E5E7EB",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4
  },
  messageMeta: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    fontSize: 11,
    color: "#9CA3AF"
  },
  typingIndicator: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "10px 14px",
    background: "#FFFFFF",
    border: "1px solid #E5E7EB",
    borderRadius: 12,
    borderBottomLeftRadius: 4,
    width: "fit-content",
    gap: 6
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#9CA3AF",
    animation: "bounce 1.4s infinite"
  },
  inputBar: {
    padding: "16px 24px",
    borderTop: "1px solid #E5E7EB",
    background: "#FFFFFF",
    display: "flex",
    gap: 12,
    alignItems: "flex-end"
  },
  textarea: {
    flex: 1,
    padding: "10px 16px",
    borderRadius: 20,
    border: "1px solid #E5E7EB",
    fontSize: 14,
    fontFamily: "inherit",
    resize: "none",
    outline: "none",
    maxHeight: 120,
    background: "#F9FAFB"
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    background: "#2563EB",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "all 0.2s",
    flexShrink: 0
  },
  emptyState: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    color: "#9CA3AF"
  },
  quickReplies: {
    padding: "12px 24px",
    borderTop: "1px solid #E5E7EB",
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    background: "#FFFFFF"
  },
  quickReplyBtn: {
    padding: "6px 12px",
    borderRadius: 16,
    background: "#F3F4F6",
    border: "none",
    fontSize: 12,
    cursor: "pointer",
    transition: "all 0.2s"
  }
};

// Quick reply templates
const QUICK_REPLIES = [
  "Thanks for reaching out! I'll look into this right away.",
  "I've escalated this to our technical team. They'll get back to you within 24 hours.",
  "Could you please provide more details about the issue?",
  "Your payment has been processed successfully.",
  "I've updated your vehicle information. It should reflect within 24 hours.",
  "I'm marking this ride as a no-show for you. The fee will be added to your next payout."
];

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export function ChatTab({ onBack, onToast }) {
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all"); // all, unread, active
  const [typing, setTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [driverDetails, setDriverDetails] = useState(null);
  
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // ─────────────────────────────────────────────────────────
  // LOAD CONVERSATIONS (SupportThreads)
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, "SupportThreads"),
      orderBy("updatedAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const convs = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setConversations(convs);
        
        // If selected conversation still exists, update it
        if (selectedConv) {
          const updated = convs.find(c => c.id === selectedConv.id);
          if (updated) setSelectedConv(updated);
        }
      },
      (err) => {
        console.error("Conversations error:", err);
        onToast?.("Failed to load conversations", "error");
      }
    );

    return () => unsub();
  }, []);

  // ─────────────────────────────────────────────────────────
  // LOAD MESSAGES FOR SELECTED CONVERSATION
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedConv) return;

    const messagesRef = collection(db, "Support");
    const q = query(
      messagesRef,
      where("threadId", "==", selectedConv.id),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(
      q,
      async (snap) => {
        const msgs = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setMessages(msgs);

        // Mark unread messages as read
        const unreadMessages = msgs.filter(
          m => m.status === "unread" && m.sender !== "admin"
        );
        
        if (unreadMessages.length > 0) {
          const batch = writeBatch(db);
          unreadMessages.forEach(msg => {
            const msgRef = doc(db, "Support", msg.id);
            batch.update(msgRef, { status: "read" });
          });
          
          // Also update thread unread count
          const threadRef = doc(db, "SupportThreads", selectedConv.id);
          batch.update(threadRef, { 
            unreadByAdmin: 0,
            lastReadAt: serverTimestamp()
          });
          
          await batch.commit();
        }

        // Fetch driver details if not already loaded
        if (selectedConv.driverId && !driverDetails) {
          const driverRef = doc(db, "Drivers", selectedConv.driverId);
          const driverSnap = await getDoc(driverRef);
          if (driverSnap.exists()) {
            setDriverDetails(driverSnap.data());
          }
        }
      },
      (err) => {
        console.error("Messages error:", err);
        onToast?.("Failed to load messages", "error");
      }
    );

    return () => unsub();
  }, [selectedConv]);

  // ─────────────────────────────────────────────────────────
  // AUTO SCROLL
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ─────────────────────────────────────────────────────────
  // SEND MESSAGE
  // ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (customMessage = null) => {
    const messageToSend = customMessage || newMessage.trim();
    if (!messageToSend || !selectedConv || sending) return;

    setSending(true);
    
    try {
      // Add message to Support collection
      const msgRef = collection(db, "Support");
      await addDoc(msgRef, {
        threadId: selectedConv.id,
        driverId: selectedConv.driverId,
        message: messageToSend,
        sender: "admin",
        status: "read",
        createdAt: serverTimestamp(),
        readAt: serverTimestamp()
      });

      // Update thread
      const threadRef = doc(db, "SupportThreads", selectedConv.id);
      await updateDoc(threadRef, {
        lastMessage: messageToSend,
        lastSender: "admin",
        updatedAt: serverTimestamp(),
        unreadByDriver: (selectedConv.unreadByDriver || 0) + 1
      });

      setNewMessage("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      
      onToast?.("Message sent successfully", "success");
    } catch (err) {
      console.error("Send error:", err);
      onToast?.("Failed to send message", "error");
    } finally {
      setSending(false);
    }
  }, [newMessage, selectedConv, sending]);

  // ─────────────────────────────────────────────────────────
  // HANDLE KEY PRESS
  // ─────────────────────────────────────────────────────────
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ─────────────────────────────────────────────────────────
  // AUTO-RESIZE TEXTAREA
  // ─────────────────────────────────────────────────────────
  const handleTextareaChange = (e) => {
    setNewMessage(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  // ─────────────────────────────────────────────────────────
  // FILTER CONVERSATIONS
  // ─────────────────────────────────────────────────────────
  const filteredConversations = useMemo(() => {
    let filtered = conversations;
    
    if (filter === "unread") {
      filtered = filtered.filter(c => (c.unreadByAdmin || 0) > 0);
    } else if (filter === "active") {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      filtered = filtered.filter(c => {
        const updatedAt = c.updatedAt?.toDate?.() || new Date(c.updatedAt);
        return updatedAt > oneDayAgo;
      });
    }
    
    if (searchTerm) {
      filtered = filtered.filter(c => 
        c.driverName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.driverEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  }, [conversations, filter, searchTerm]);

  // ─────────────────────────────────────────────────────────
  // FORMAT TIME
  // ─────────────────────────────────────────────────────────
  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    if (diff < 604800000) return date.toLocaleDateString(undefined, { weekday: "short" });
    return date.toLocaleDateString();
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <button 
            onClick={onBack} 
            style={styles.backButton}
            onMouseEnter={(e) => e.target.style.background = "#E5E7EB"}
            onMouseLeave={(e) => e.target.style.background = "#F3F4F6"}
          >
            ←
          </button>
          <MessageCircle size={20} color="#2563EB" />
          <span style={styles.headerTitle}>Support Chat</span>
        </div>
        
        <div style={styles.stats}>
          <div style={styles.statBadge}>
            <Clock size={14} />
            <span>Response time: &lt;5 min</span>
          </div>
          <div style={styles.statBadge}>
            <MessageCircle size={14} />
            <span>{conversations.length} active chats</span>
          </div>
        </div>
      </div>

      <div style={styles.body}>
        {/* Sidebar */}
        <div style={styles.sidebar}>
          <div style={styles.searchBar}>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
          </div>
          
          <div style={styles.filterBar}>
            {[
              { key: "all", label: "All" },
              { key: "unread", label: "Unread" },
              { key: "active", label: "Active (24h)" }
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  ...styles.filterChip,
                  background: filter === f.key ? "#2563EB" : "#F3F4F6",
                  color: filter === f.key ? "white" : "#6B7280"
                }}
              >
                {f.label}
                {f.key === "unread" && conversations.filter(c => (c.unreadByAdmin || 0) > 0).length > 0 && (
                  <span style={{ marginLeft: 4, fontWeight: 600 }}>
                    ({conversations.filter(c => (c.unreadByAdmin || 0) > 0).length})
                  </span>
                )}
              </button>
            ))}
          </div>
          
          <div style={styles.convList}>
            {filteredConversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => {
                  setSelectedConv(conv);
                  setDriverDetails(null);
                }}
                style={{
                  ...styles.convItem,
                  background: selectedConv?.id === conv.id ? "#F3F4F6" : "transparent"
                }}
              >
                <div style={styles.convHeader}>
                  <span style={styles.convName}>
                    {conv.driverName || conv.driverId?.slice(0, 8) || "Unknown Driver"}
                  </span>
                  <span style={styles.convTime}>
                    {formatTime(conv.updatedAt)}
                  </span>
                </div>
                <div style={styles.convPreview}>
                  {conv.lastMessage || "No messages yet"}
                </div>
                <div style={styles.convMeta}>
                  {conv.unreadByAdmin > 0 && (
                    <span style={styles.unreadBadge}>
                      {conv.unreadByAdmin} new
                    </span>
                  )}
                  {conv.lastSender === "driver" && (
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Reply size={12} />
                      Driver
                    </span>
                  )}
                </div>
              </div>
            ))}
            
            {filteredConversations.length === 0 && (
              <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>
                No conversations found
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div style={styles.chatArea}>
          {!selectedConv ? (
            <div style={styles.emptyState}>
              <MessageCircle size={48} strokeWidth={1.5} />
              <div>Select a conversation to start replying</div>
            </div>
          ) : (
            <>
              {/* Chat Header with Driver Info */}
              <div style={styles.chatHeader}>
                <div style={styles.driverInfo}>
                  <div style={styles.driverAvatar}>
                    {driverDetails?.firstName?.[0]}
                    {driverDetails?.lastName?.[0]}
                  </div>
                  <div style={styles.driverDetails}>
                    <span style={styles.driverName}>
                      {driverDetails?.firstName} {driverDetails?.lastName}
                    </span>
                    <div style={styles.driverRating}>
                      <Star size={14} fill="#F59E0B" color="#F59E0B" />
                      <span>{driverDetails?.averageRating?.toFixed(1) || "New"}</span>
                      <span>•</span>
                      <Mail size={12} />
                      <span>{driverDetails?.email || selectedConv.driverEmail}</span>
                    </div>
                  </div>
                </div>
                
                <div style={styles.actionButtons}>
                  <button style={styles.actionBtn}>
                    <Copy size={14} />
                    Copy ID
                  </button>
                  <button style={styles.actionBtn}>
                    <Flag size={14} />
                    Report
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div style={styles.messages}>
                {messages.map((msg, idx) => {
                  const isAdmin = msg.sender === "admin";
                  const showAvatar = !isAdmin && (idx === 0 || messages[idx-1]?.sender !== "driver");
                  
                  return (
                    <div key={msg.id} style={styles.messageGroup}>
                      <div
                        style={{
                          ...styles.messageBubble,
                          ...(isAdmin ? styles.messageOutgoing : styles.messageIncoming)
                        }}
                      >
                        {msg.message}
                      </div>
                      <div
                        style={{
                          ...styles.messageMeta,
                          justifyContent: isAdmin ? "flex-end" : "flex-start"
                        }}
                      >
                        {isAdmin ? (
                          <>
                            <span>Admin</span>
                            <span>•</span>
                            <span>{formatTime(msg.createdAt)}</span>
                            {msg.status === "read" ? (
                              <CheckCheck size={12} color="#22C55E" />
                            ) : (
                              <Check size={12} color="#9CA3AF" />
                            )}
                          </>
                        ) : (
                          <>
                            <span>{driverDetails?.firstName || "Driver"}</span>
                            <span>•</span>
                            <span>{formatTime(msg.createdAt)}</span>
                            {msg.isAuto && <span>• Auto-reply</span>}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                {typing && (
                  <div style={styles.typingIndicator}>
                    <span style={{ fontSize: 12, color: "#6B7280" }}>Driver is typing</span>
                    {[0, 0.2, 0.4].map(delay => (
                      <div
                        key={delay}
                        style={{
                          ...styles.typingDot,
                          animationDelay: `${delay}s`
                        }}
                      />
                    ))}
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Replies */}
              <div style={styles.quickReplies}>
                {QUICK_REPLIES.slice(0, 4).map((reply, idx) => (
                  <button
                    key={idx}
                    style={styles.quickReplyBtn}
                    onClick={() => sendMessage(reply)}
                  >
                    {reply.length > 30 ? reply.slice(0, 30) + "..." : reply}
                  </button>
                ))}
              </div>

              {/* Input Area */}
              <div style={styles.inputBar}>
                <textarea
                  ref={textareaRef}
                  value={newMessage}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyPress}
                  placeholder="Type your reply... (Shift+Enter for new line)"
                  rows={1}
                  style={styles.textarea}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!newMessage.trim() || sending}
                  style={{
                    ...styles.sendButton,
                    opacity: !newMessage.trim() || sending ? 0.5 : 1,
                    cursor: !newMessage.trim() || sending ? "not-allowed" : "pointer"
                  }}
                >
                  {sending ? (
                    <div style={{ width: 16, height: 16, border: "2px solid white", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  ) : (
                    <Send size={16} color="white" />
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add keyframe animations */}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-4px); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}