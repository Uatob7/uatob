// src/App/Admin/useChat.js
import { useState, useEffect } from 'react';
import { firebase_app } from "@/firebase/config";
import { getFirestore, collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc } from "firebase/firestore";

const db = getFirestore(firebase_app);

export function useChat(conversationId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!conversationId) return;

    const q = query(
      collection(db, `conversations/${conversationId}/messages`),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(newMessages);
      setLoading(false);
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });

    return unsubscribe;
  }, [conversationId]);

  const sendMessage = async (text, senderId, senderName) => {
    if (!conversationId || !text.trim()) return;

    try {
      await addDoc(collection(db, `conversations/${conversationId}/messages`), {
        text,
        senderId,
        senderName,
        timestamp: new Date(),
        status: "delivered"
      });
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const markAsRead = async (messageId) => {
    try {
      await updateDoc(doc(db, `conversations/${conversationId}/messages/${messageId}`), {
        readAt: new Date()
      });
    } catch (err) {
      console.error("Error marking message as read:", err);
    }
  };

  return { messages, loading, error, sendMessage, markAsRead };
}