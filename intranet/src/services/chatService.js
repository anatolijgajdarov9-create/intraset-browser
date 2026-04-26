const { v4: uuidv4 } = require('uuid');
const config = require('../config');

class ChatService {
  constructor(db) {
    this.db = db;
    this.messageHandlers = [];
  }
  
  sendMessage(senderId, receiverId, content, type = 'text') {
    const message = {
      id: uuidv4(),
      senderId,
      receiverId,
      content,
      type,
      timestamp: Math.floor(Date.now() / 1000),
      read: 0
    };
    
    try {
      this.db.messages.insert(message);
      console.log('[Chat] Message sent:', senderId, '->', receiverId || 'broadcast');
      
      this.messageHandlers.forEach(handler => {
        try {
          handler(message);
        } catch (err) {
          console.error('[Chat] Handler error:', err.message);
        }
      });
      
      return message;
    } catch (err) {
      console.error('[Chat] Send error:', err.message);
      return null;
    }
  }
  
  getConversation(nodeId, otherNodeId) {
    try {
      return this.db.messages.getConversation(nodeId, otherNodeId);
    } catch (err) {
      console.error('[Chat] Get conversation error:', err.message);
      return [];
    }
  }
  
  getAllMessages(limit = 100) {
    try {
      return this.db.messages.getAll(limit);
    } catch (err) {
      console.error('[Chat] Get messages error:', err.message);
      return [];
    }
  }
  
  getUnreadCount(nodeId) {
    try {
      return this.db.messages.getUnreadCount(nodeId) || 0;
    } catch (err) {
      console.error('[Chat] Get unread error:', err.message);
      return 0;
    }
  }
  
  markAsRead(nodeId) {
    try {
      this.db.messages.markRead(nodeId);
      console.log('[Chat] Messages marked as read for:', nodeId);
    } catch (err) {
      console.error('[Chat] Mark read error:', err.message);
    }
  }
  
  onMessage(handler) {
    this.messageHandlers.push(handler);
  }
  
  offMessage(handler) {
    this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
  }
  
  broadcast(senderId, content, type = 'text') {
    return this.sendMessage(senderId, null, content, type);
  }
  
  getContacts(nodeId) {
    try {
      const messages = this.db.messages.getAll(config.chat.maxHistory);
      const contacts = new Map();
      
      messages.forEach(msg => {
        const contactId = msg.sender_id === nodeId ? msg.receiver_id : msg.sender_id;
        if (contactId && contactId !== nodeId) {
          if (!contacts.has(contactId)) {
            contacts.set(contactId, {
              nodeId: contactId,
              lastMessage: msg,
              unread: msg.receiver_id === nodeId && !msg.read ? 1 : 0
            });
          } else if (msg.timestamp > contacts.get(contactId).lastMessage.timestamp) {
            contacts.get(contactId).lastMessage = msg;
            if (msg.receiver_id === nodeId && !msg.read) {
              contacts.get(contactId).unread++;
            }
          }
        }
      });
      
      return Array.from(contacts.values()).sort((a, b) => 
        b.lastMessage.timestamp - a.lastMessage.timestamp
      );
    } catch (err) {
      console.error('[Chat] Get contacts error:', err.message);
      return [];
    }
  }
}

module.exports = ChatService;
