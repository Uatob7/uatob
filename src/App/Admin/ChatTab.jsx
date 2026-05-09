// src/App/Admin/ChatTab.js
import { useState, useEffect, useRef, useCallback } from "react";
import { 
  Send, 
  Users, 
  Search, 
  MessageCircle, 
  Phone, 
  Video, 
  MoreVertical,
  Check,
  CheckCheck,
  Image as ImageIcon,
  Paperclip,
  X
} from "lucide-react";
import { C } from "@/App/Admin/Tokens";

// Mock data - replace with your actual Firebase/Firestore calls
const MOCK_CONVERSATIONS = [
  { id: "conv1", userId: "user123", name: "John Driver", role: "driver", avatar: "JD", lastMessage: "I'm on my way to pickup", timestamp: "2 min ago", unread: 2, online: true },
  { id: "conv2", userId: "user456", name: "Sarah Rider", role: "rider", avatar: "SR", lastMessage: "Thanks for the ride!", timestamp: "1 hour ago", unread: 0, online: false },
  { id: "conv3", userId: "user789", name: "Mike Fleet", role: "fleet_owner", avatar: "MF", lastMessage: "When will the new driver be approved?", timestamp: "3 hours ago", unread: 1, online: true },
  { id: "conv4", userId: "user101", name: "Emma Support", role: "support", avatar: "ES", lastMessage: "Customer issue resolved", timestamp: "1 day ago", unread: 0, online: false },
];

const MOCK_MESSAGES = {
  conv1: [
    { id: "m1", senderId: "user123", text: "Hello admin, I have a question about my earnings", timestamp: "10:30 AM", status: "read" },
    { id: "m2", senderId: "admin", text: "Sure, let me check the system for you", timestamp: "10:32 AM", status: "read" },
    { id: "m3", senderId: "user123", text: "I'm on my way to pickup", timestamp: "10:35 AM", status: "delivered" },
  ],
  conv2: [
    { id: "m1", senderId: "user456", text: "Great service!", timestamp: "9:00 AM", status: "read" },
    { id: "m2", senderId: "admin", text: "Glad to hear that! ⭐", timestamp: "9:05 AM", status: "read" },
    { id: "m3", senderId: "user456", text: "Thanks for the ride!", timestamp: "9:10 AM", status: "read" },
  ],
};

export function ChatTab({ onBack, onToast }) {
  const [conversations, setConversations] = useState(MOCK_CONVERSATIONS);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load messages when conversation is selected
  useEffect(() => {
    if (selectedConv) {
      setMessages(MOCK_MESSAGES[selectedConv.id] || []);
    }
  }, [selectedConv]);

  // Simulate typing indicator
  useEffect(() => {
    if (selectedConv && selectedConv.online) {
      const timeout = setTimeout(() => setIsTyping(true), 2000);
      const hideTyping = setTimeout(() => setIsTyping(false), 5000);
      return () => {
        clearTimeout(timeout);
        clearTimeout(hideTyping);
      };
    }
  }, [selectedConv, messages]);

  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedConv) return;

    const tempMessage = {
      id: `temp-${Date.now()}`,
      senderId: "admin",
      text: newMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: "sending"
    };

    setMessages(prev => [...prev, tempMessage]);
    setNewMessage("");
    
    // Simulate API call
    try {
      // await sendMessageToFirebase(selectedConv.id, newMessage);
      setTimeout(() => {
        setMessages(prev => prev.map(msg => 
          msg.id === tempMessage.id ? { ...msg, status: "delivered" } : msg
        ));
        setTimeout(() => {
          setMessages(prev => prev.map(msg => 
            msg.id === tempMessage.id ? { ...msg, status: "read" } : msg
          ));
        }, 1000);
      }, 500);
    } catch (error) {
      onToast?.("Failed to send message");
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
    }
  }, [newMessage, selectedConv, onToast]);

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusIcon = (status) => {
    switch(status) {
      case "sending": return <div className="status-sending" />;
      case "delivered": return <Check size={12} />;
      case "read": return <CheckCheck size={12} />;
      default: return null;
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={onBack} style={styles.backButton}>
          ←
        </button>
        <MessageCircle size={20} color={C.green} />
        <span style={styles.headerTitle}>Admin Chat</span>
      </div>

      <div style={styles.chatContainer}>
        {/* Conversations Sidebar */}
        <div style={{ ...styles.sidebar, display: selectedConv ? 'none' : 'flex' }}>
          <div style={styles.searchBar}>
            <Search size={18} color={C.textMuted} />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
          </div>

          <div style={styles.conversationsList}>
            {filteredConversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => setSelectedConv(conv)}
                style={styles.conversationItem}
              >
                <div style={styles.avatarContainer}>
                  <div style={styles.avatar}>
                    {conv.avatar}
                  </div>
                  {conv.online && <div style={styles.onlineDot} />}
                </div>
                <div style={styles.conversationInfo}>
                  <div style={styles.conversationHeader}>
                    <span style={styles.conversationName}>{conv.name}</span>
                    <span style={styles.timestamp}>{conv.timestamp}</span>
                  </div>
                  <div style={styles.conversationPreview}>
                    <span style={styles.roleBadge}>{conv.role}</span>
                    <span style={styles.lastMessage}>{conv.lastMessage}</span>
                  </div>
                </div>
                {conv.unread > 0 && (
                  <div style={styles.unreadBadge}>{conv.unread}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        {selectedConv && (
          <div style={styles.chatArea}>
            {/* Chat Header */}
            <div style={styles.chatHeader}>
              <div style={styles.chatHeaderInfo}>
                <button 
                  onClick={() => setSelectedConv(null)}
                  style={styles.mobileBackButton}
                >
                  ←
                </button>
                <div style={styles.chatAvatar}>
                  {selectedConv.avatar}
                </div>
                <div>
                  <div style={styles.chatName}>{selectedConv.name}</div>
                  <div style={styles.chatStatus}>
                    {selectedConv.online ? "Online" : "Offline"}
                    {isTyping && <span style={styles.typingIndicator}> • typing...</span>}
                  </div>
                </div>
              </div>
              <div style={styles.chatActions}>
                <button style={styles.actionButton}>
                  <Phone size={18} />
                </button>
                <button style={styles.actionButton}>
                  <Video size={18} />
                </button>
                <button style={styles.actionButton}>
                  <MoreVertical size={18} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div style={styles.messagesArea}>
              {messages.map((message, idx) => {
                const isAdmin = message.senderId === "admin";
                return (
                  <div
                    key={message.id}
                    style={{
                      ...styles.messageWrapper,
                      justifyContent: isAdmin ? "flex-end" : "flex-start"
                    }}
                  >
                    <div
                      style={{
                        ...styles.message,
                        ...(isAdmin ? styles.adminMessage : styles.userMessage)
                      }}
                    >
                      <div style={styles.messageText}>{message.text}</div>
                      <div style={styles.messageMeta}>
                        <span style={styles.messageTime}>{message.timestamp}</span>
                        {isAdmin && getStatusIcon(message.status)}
                      </div>
                    </div>
                  </div>
                );
              })}
              {isTyping && (
                <div style={styles.typingContainer}>
                  <div style={styles.typingBubble}>
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div style={styles.inputArea}>
              <button style={styles.attachButton}>
                <Paperclip size={18} />
              </button>
              <button style={styles.imageButton}>
                <ImageIcon size={18} />
              </button>
              <textarea
                ref={inputRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                style={styles.messageInput}
                rows={1}
              />
              <button 
                onClick={handleSendMessage}
                disabled={!newMessage.trim()}
                style={{
                  ...styles.sendButton,
                  opacity: newMessage.trim() ? 1 : 0.5,
                  cursor: newMessage.trim() ? "pointer" : "not-allowed"
                }}
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .typing-dot {
          width: 6px;
          height: 6px;
          background: ${C.textMuted};
          border-radius: 50%;
          display: inline-block;
          margin: 0 2px;
          animation: typingAnimation 1.4s infinite;
        }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        
        @keyframes typingAnimation {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
        
        .status-sending {
          width: 12px;
          height: 12px;
          border: 1.5px solid ${C.textMuted};
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    background: "#fff",
    borderRadius: "24px",
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    height: "calc(100vh - 140px)",
    display: "flex",
    flexDirection: "column"
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "16px 20px",
    borderBottom: `1px solid ${C.border}`,
    background: "#fff"
  },
  backButton: {
    background: "none",
    border: "none",
    fontSize: "20px",
    cursor: "pointer",
    color: C.text,
    padding: "4px 8px",
    borderRadius: "8px"
  },
  headerTitle: {
    fontSize: "18px",
    fontWeight: 700,
    color: C.text,
    flex: 1
  },
  chatContainer: {
    flex: 1,
    display: "flex",
    overflow: "hidden"
  },
  sidebar: {
    width: "320px",
    borderRight: `1px solid ${C.border}`,
    display: "flex",
    flexDirection: "column",
    background: "#FAFBFC"
  },
  searchBar: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 16px",
    borderBottom: `1px solid ${C.border}`,
    background: "#fff"
  },
  searchInput: {
    flex: 1,
    border: "none",
    outline: "none",
    fontSize: "14px",
    background: "transparent",
    fontFamily: "'Barlow', sans-serif"
  },
  conversationsList: {
    flex: 1,
    overflowY: "auto"
  },
  conversationItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px 16px",
    cursor: "pointer",
    transition: "background 0.15s",
    position: "relative",
    borderBottom: `1px solid ${C.border}`,
    background: "#fff"
  },
  avatarContainer: {
    position: "relative"
  },
  avatar: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    background: `linear-gradient(135deg, ${C.green}, ${C.greenDark})`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontWeight: 700,
    fontSize: "16px"
  },
  onlineDot: {
    position: "absolute",
    bottom: "2px",
    right: "2px",
    width: "12px",
    height: "12px",
    background: "#22c55e",
    borderRadius: "50%",
    border: "2px solid #fff"
  },
  conversationInfo: {
    flex: 1,
    minWidth: 0
  },
  conversationHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "4px"
  },
  conversationName: {
    fontWeight: 600,
    fontSize: "14px",
    color: C.text
  },
  timestamp: {
    fontSize: "11px",
    color: C.textMuted
  },
  conversationPreview: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "12px",
    color: C.textMuted,
    whiteSpace: "nowrap",
    overflow: "hidden"
  },
  roleBadge: {
    background: C.surfaceHigh,
    padding: "2px 6px",
    borderRadius: "4px",
    fontSize: "10px",
    fontWeight: 600,
    textTransform: "uppercase"
  },
  lastMessage: {
    overflow: "hidden",
    textOverflow: "ellipsis"
  },
  unreadBadge: {
    background: C.green,
    color: "#fff",
    borderRadius: "12px",
    padding: "2px 6px",
    fontSize: "11px",
    fontWeight: 700,
    minWidth: "20px",
    textAlign: "center"
  },
  chatArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    background: "#fff"
  },
  chatHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 20px",
    borderBottom: `1px solid ${C.border}`,
    background: "#fff"
  },
  chatHeaderInfo: {
    display: "flex",
    alignItems: "center",
    gap: "12px"
  },
  mobileBackButton: {
    display: "none",
    background: "none",
    border: "none",
    fontSize: "20px",
    cursor: "pointer",
    color: C.text,
    "@media (max-width: 768px)": {
      display: "block"
    }
  },
  chatAvatar: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    background: `linear-gradient(135deg, ${C.green}, ${C.greenDark})`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontWeight: 700
  },
  chatName: {
    fontWeight: 600,
    fontSize: "15px",
    color: C.text
  },
  chatStatus: {
    fontSize: "12px",
    color: C.textMuted
  },
  typingIndicator: {
    color: C.green,
    fontStyle: "italic"
  },
  chatActions: {
    display: "flex",
    gap: "8px"
  },
  actionButton: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "8px",
    borderRadius: "8px",
    color: C.textMuted
  },
  messagesArea: {
    flex: 1,
    overflowY: "auto",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },
  messageWrapper: {
    display: "flex"
  },
  message: {
    maxWidth: "70%",
    padding: "10px 14px",
    borderRadius: "12px",
    position: "relative"
  },
  userMessage: {
    background: C.surfaceHigh,
    color: C.text,
    borderBottomLeftRadius: "4px"
  },
  adminMessage: {
    background: C.green,
    color: "#fff",
    borderBottomRightRadius: "4px"
  },
  messageText: {
    fontSize: "14px",
    lineHeight: "1.4",
    wordWrap: "break-word"
  },
  messageMeta: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "4px",
    marginTop: "4px",
    fontSize: "10px",
    opacity: 0.7
  },
  messageTime: {
    fontSize: "10px"
  },
  typingContainer: {
    display: "flex",
    justifyContent: "flex-start"
  },
  typingBubble: {
    background: C.surfaceHigh,
    padding: "10px 14px",
    borderRadius: "12px",
    borderBottomLeftRadius: "4px"
  },
  inputArea: {
    display: "flex",
    alignItems: "flex-end",
    gap: "8px",
    padding: "16px 20px",
    borderTop: `1px solid ${C.border}`,
    background: "#fff"
  },
  attachButton: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "8px",
    borderRadius: "8px",
    color: C.textMuted
  },
  imageButton: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "8px",
    borderRadius: "8px",
    color: C.textMuted
  },
  messageInput: {
    flex: 1,
    border: `1px solid ${C.border}`,
    borderRadius: "20px",
    padding: "8px 16px",
    fontSize: "14px",
    fontFamily: "'Barlow', sans-serif",
    resize: "none",
    outline: "none",
    maxHeight: "100px"
  },
  sendButton: {
    background: C.green,
    border: "none",
    cursor: "pointer",
    padding: "8px 12px",
    borderRadius: "20px",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    transition: "opacity 0.15s"
  }
};

// Add responsive styles
if (typeof window !== "undefined") {
  const style = document.createElement('style');
  style.textContent = `
    @media (max-width: 768px) {
      .sidebar-active {
        width: 100% !important;
      }
      .chat-area-active {
        width: 100% !important;
      }
    }
  `;
  document.head.appendChild(style);
}