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
  Flag,
  ArrowLeft,
  Zap
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
import { onAuthStateChanged } from "firebase/auth";
import { firebase_app, auth } from "@/firebase/config";

const db = getFirestore(firebase_app);

// ─────────────────────────────────────────────────────────────
// MODERN STYLES
// ─────────────────────────────────────────────────────────────
const styles = {
  container: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    background: "#FFFFFF",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
  },
  header: {
    background: "#FFFFFF",
    borderBottom: "1px solid #E5E7EB",
    padding: "16px 28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)"
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 16
  },
  backButton: {
    border: "none",
    background: "#F3F4F6",
    borderRadius: 10,
    width: 40,
    height: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontSize: 18,
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    color: "#374151",
    hover: "background 0.3s"
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#111827",
    letterSpacing: "-0.5px"
  },
  stats: {
    display: "flex",
    gap: 12,
    alignItems: "center"
  },
  statBadge: {
    background: "#EFF6FF",
    padding: "8px 14px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    color: "#0369A1",
    display: "flex",
    alignItems: "center",
    gap: 6,
    border: "1px solid #BFE0F1"
  },
  body: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
    gap: 0,
    background: "#FFFFFF"
  },
  sidebar: {
    width: 360,
    background: "#F9FAFB",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRight: "1px solid #E5E7EB"
  },
  searchBar: {
    padding: 16,
    borderBottom: "1px solid #E5E7EB"
  },
  searchInput: {
    width: "100%",
    padding: "12px 16px 12px 16px",
    borderRadius: 12,
    border: "1px solid #D1D5DB",
    fontSize: 14,
    background: "#FFFFFF",
    color: "#111827",
    outline: "none",
    transition: "all 0.3s"
  },
  filterBar: {
    padding: "12px 16px",
    borderBottom: "1px solid #E5E7EB",
    display: "flex",
    gap: 8,
    flexWrap: "wrap"
  },
  filterChip: {
    padding: "8px 14px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    background: "#F3F4F6",
    color: "#6B7280",
    border: "1px solid #D1D5DB"
  },
  convList: {
    flex: 1,
    overflowY: "auto"
  },
  convItem: {
    padding: 14,
    margin: "8px 8px",
    borderBottom: "none",
    cursor: "pointer",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    position: "relative",
    borderRadius: 12,
    background: "#FFFFFF",
    border: "1px solid #E5E7EB"
  },
  convHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8
  },
  convName: {
    fontWeight: 700,
    fontSize: 14,
    color: "#111827"
  },
  convTime: {
    fontSize: 11,
    color: "#9CA3AF"
  },
  convPreview: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 10,
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
    background: "#FEE2E2",
    color: "#DC2626",
    borderRadius: 12,
    padding: "4px 10px",
    fontSize: 11,
    fontWeight: 700
  },
  chatArea: {
    flex: 1,
    background: "#FFFFFF",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden"
  },
  chatHeader: {
    padding: "20px 28px",
    borderBottom: "1px solid #E5E7EB",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#FFFFFF"
  },
  driverInfo: {
    display: "flex",
    alignItems: "center",
    gap: 14
  },
  driverAvatar: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)",
    border: "2px solid #DBEAFE",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 18,
    color: "#FFFFFF",
    boxShadow: "0 4px 12px rgba(59, 130, 246, 0.15)"
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
    gap: 6,
    fontSize: 13,
    color: "#6B7280"
  },
  actionButtons: {
    display: "flex",
    gap: 10
  },
  actionBtn: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #D1D5DB",
    background: "#F3F4F6",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: 6,
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    color: "#374151"
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "24px 28px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    background: "#FFFFFF"
  },
  messageGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 4
  },
  messageBubble: {
    maxWidth: "65%",
    padding: "12px 16px",
    borderRadius: 14,
    fontSize: 14,
    lineHeight: 1.5,
    position: "relative",
    wordWrap: "break-word",
    wordBreak: "break-word"
  },
  messageOutgoing: {
    background: "linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%)",
    color: "white",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
    boxShadow: "0 4px 12px rgba(59, 130, 246, 0.2)"
  },
  messageIncoming: {
    background: "#F3F4F6",
    color: "#111827",
    border: "1px solid #E5E7EB",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4
  },
  messageMeta: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    fontSize: 11,
    color: "#9CA3AF"
  },
  typingIndicator: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "12px 16px",
    background: "#F3F4F6",
    border: "1px solid #E5E7EB",
    borderRadius: 14,
    borderBottomLeftRadius: 4,
    width: "fit-content"
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#9CA3AF",
    animation: "bounce 1.4s infinite"
  },
  inputBar: {
    padding: "16px 28px",
    borderTop: "1px solid #E5E7EB",
    background: "#FFFFFF",
    display: "flex",
    gap: 12,
    alignItems: "flex-end"
  },
  textarea: {
    flex: 1,
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid #D1D5DB",
    fontSize: 14,
    fontFamily: "inherit",
    resize: "none",
    outline: "none",
    maxHeight: 120,
    background: "#F9FAFB",
    color: "#111827",
    transition: "all 0.3s"
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%)",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    flexShrink: 0,
    boxShadow: "0 4px 12px rgba(59, 130, 246, 0.2)"
  },
  emptyState: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    color: "#9CA3AF"
  },
  quickReplies: {
    padding: "16px 28px",
    borderTop: "1px solid #E5E7EB",
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    background: "#FFFFFF",
    maxHeight: 80,
    overflowY: "auto"
  },
  quickReplyBtn: {
    padding: "8px 12px",
    borderRadius: 10,
    background: "#F3F4F6",
    border: "1px solid #D1D5DB",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    color: "#374151",
    whiteSpace: "nowrap"
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
  const [user, setUser] = useState(null);
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

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });

    return () => unsubAuth();
  }, []);

  // ─────────────────────────────────────────────────────────
  // LOAD CONVERSATIONS (SupportThreads)
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return; // wait for authenticated user to avoid permission errors

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
  }, [user]);

  // ─────────────────────────────────────────────────────────
  // LOAD MESSAGES FOR SELECTED CONVERSATION
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedConv || !user) return;

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
          try {
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
          } catch (err) {
            console.error("Error marking messages as read:", err);
            // Silently fail - don't show error to user as this is a non-critical operation
          }
        }

        // Fetch driver details if not already loaded
        if (selectedConv.driverId && !driverDetails) {
          try {
            const driverRef = doc(db, "Drivers", selectedConv.driverId);
            const driverSnap = await getDoc(driverRef);
            if (driverSnap.exists()) {
              setDriverDetails(driverSnap.data());
            }
          } catch (err) {
            console.error("Error fetching driver details:", err);
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
            title="Go back"
          >
            <ArrowLeft size={20} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <MessageCircle size={24} color="#3B82F6" />
            <div>
              <h1 style={styles.headerTitle}>Support Chat</h1>
              <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>Admin messaging hub</p>
            </div>
          </div>
        </div>
        
        <div style={styles.stats}>
          <div style={styles.statBadge}>
            <Zap size={14} />
            <span>Response: &lt;5 min</span>
          </div>
          <div style={styles.statBadge}>
            <MessageCircle size={14} />
            <span>{conversations.length} active</span>
          </div>
        </div>
      </div>

      <div style={styles.body}>
        {/* Sidebar */}
        <div style={styles.sidebar}>
          <div style={styles.searchBar}>
            <div style={{ position: "relative" }}>
              <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
              <input
                type="text"
                placeholder="Search drivers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ ...styles.searchInput, paddingLeft: 36 }}
                onFocus={(e) => e.target.style.borderColor = "#3B82F6"}
                onBlur={(e) => e.target.style.borderColor = "#D1D5DB"}
              />
            </div>
          </div>
          
          <div style={styles.filterBar}>
            {[
              { key: "all", label: "All", icon: MessageCircle },
              { key: "unread", label: "Unread", icon: AlertCircle },
              { key: "active", label: "24h Active", icon: Clock }
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  ...styles.filterChip,
                  background: filter === f.key ? "#EFF6FF" : "#F3F4F6",
                  color: filter === f.key ? "#0369A1" : "#6B7280",
                  border: filter === f.key ? "1px solid #BFE0F1" : "1px solid #D1D5DB"
                }}
              >
                {f.label}
                {f.key === "unread" && conversations.filter(c => (c.unreadByAdmin || 0) > 0).length > 0 && (
                  <span style={{ marginLeft: 4, fontWeight: 700, color: "#DC2626" }}>
                    •
                  </span>
                )}
              </button>
            ))}
          </div>
          
          <div style={styles.convList}>
            {filteredConversations.length > 0 ? (
              filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => {
                    setSelectedConv(conv);
                    setDriverDetails(null);
                  }}
                  style={{
                    ...styles.convItem,
                    background: selectedConv?.id === conv.id 
                      ? "#EFF6FF"
                      : "#FFFFFF",
                    borderColor: selectedConv?.id === conv.id ? "#BFE0F1" : "#E5E7EB"
                  }}
                  onMouseEnter={(e) => {
                    if (selectedConv?.id !== conv.id) {
                      e.currentTarget.style.background = "#F3F4F6";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedConv?.id !== conv.id) {
                      e.currentTarget.style.background = "#FFFFFF";
                    }
                  }}
                >
                  <div style={styles.convHeader}>
                    <span style={styles.convName}>
                      {conv.driverName || conv.driverId?.slice(0, 8) || "Unknown"}
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
                      <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#0369A1" }}>
                        <Reply size={11} />
                        Driver
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div style={styles.emptyState}>
                <MessageCircle size={40} strokeWidth={1} opacity={0.3} />
                <div style={{ textAlign: "center" }}>
                  <p style={{ margin: "0 0 4px 0", fontWeight: 600 }}>No conversations</p>
                  <p style={{ margin: 0, fontSize: 12 }}>Try adjusting your filters</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div style={styles.chatArea}>
          {!selectedConv ? (
            <div style={styles.emptyState}>
              <MessageCircle size={56} strokeWidth={1} opacity={0.2} />
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 600 }}>No conversation selected</p>
                <p style={{ margin: 0, fontSize: 13 }}>Choose a driver from the list to start messaging</p>
              </div>
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
                      {driverDetails?.averageRating ? (
                        <>
                          <Star size={14} fill="#FBBF24" color="#FBBF24" />
                          <span>{driverDetails.averageRating.toFixed(1)}</span>
                          <span>•</span>
                        </>
                      ) : (
                        <>
                          <span style={{ color: "#94A3B8" }}>New Driver</span>
                          <span>•</span>
                        </>
                      )}
                      <Mail size={12} />
                      <span>{driverDetails?.email || selectedConv.driverEmail}</span>
                    </div>
                  </div>
                </div>
                
                <div style={styles.actionButtons}>
                  <button 
                    style={styles.actionBtn}
                    onClick={() => navigator.clipboard.writeText(selectedConv.driverId)}
                    title="Copy driver ID"
                  >
                    <Copy size={14} />
                    Copy ID
                  </button>
                  <button 
                    style={styles.actionBtn}
                    title="Report driver"
                  >
                    <Flag size={14} />
                    Report
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div style={styles.messages}>
                {messages.length === 0 && (
                  <div style={{ ...styles.emptyState, gap: 12 }}>
                    <MessageCircle size={40} strokeWidth={1} opacity={0.3} />
                    <span style={{ fontSize: 13 }}>No messages yet</span>
                  </div>
                )}
                {messages.map((msg, idx) => {
                  const isAdmin = msg.sender === "admin";
                  
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
                            <span style={{ fontWeight: 600 }}>You</span>
                            <span>•</span>
                            <span>{formatTime(msg.createdAt)}</span>
                            {msg.status === "read" ? (
                              <CheckCheck size={12} color="#10B981" />
                            ) : (
                              <Check size={12} color="#94A3B8" />
                            )}
                          </>
                        ) : (
                          <>
                            <span>{driverDetails?.firstName || "Driver"}</span>
                            <span>•</span>
                            <span>{formatTime(msg.createdAt)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                {typing && (
                  <div style={styles.typingIndicator}>
                    <span style={{ fontSize: 12, color: "#94A3B8" }}>Driver is typing</span>
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
                    onMouseEnter={(e) => {
                      e.target.style.background = "#DBEAFE";
                      e.target.style.borderColor = "#BFE0F1";
                      e.target.style.color = "#0369A1";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = "#F3F4F6";
                      e.target.style.borderColor = "#D1D5DB";
                      e.target.style.color = "#374151";
                    }}
                    title={reply}
                  >
                    {reply.length > 28 ? reply.slice(0, 28) + "..." : reply}
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
                  placeholder="Type a reply... (Shift+Enter for new line)"
                  rows={1}
                  style={styles.textarea}
                  onFocus={(e) => e.target.style.borderColor = "#3B82F6"}
                  onBlur={(e) => e.target.style.borderColor = "#D1D5DB"}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!newMessage.trim() || sending}
                  style={{
                    ...styles.sendButton,
                    opacity: !newMessage.trim() || sending ? 0.5 : 1,
                    cursor: !newMessage.trim() || sending ? "not-allowed" : "pointer"
                  }}
                  onMouseEnter={(e) => {
                    if (!sending && newMessage.trim()) {
                      e.target.style.boxShadow = "0 8px 20px rgba(59, 130, 246, 0.25)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.boxShadow = "0 4px 12px rgba(59, 130, 246, 0.2)";
                  }}
                  title="Send message"
                >
                  {sending ? (
                    <div style={{ width: 18, height: 18, border: "2px solid transparent", borderTopColor: "white", borderRightColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  ) : (
                    <Send size={18} color="white" />
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 1; }
          40% { transform: translateY(-4px); opacity: 0.7; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        /* Scrollbar styling */
        div::-webkit-scrollbar {
          width: 8px;
        }
        div::-webkit-scrollbar-track {
          background: transparent;
        }
        div::-webkit-scrollbar-thumb {
          background: #D1D5DB;
          border-radius: 4px;
        }
        div::-webkit-scrollbar-thumb:hover {
          background: #9CA3AF;
        }
      `}</style>
    </div>
  );
}