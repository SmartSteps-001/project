// modules/chatState.js
import express from 'express';

// Global chat state storage
let globalChatState = { chatDisabled: false };

/**
 * Setup chat state management routes and functionality
 * @param {Express} app - Express application instance
 * @param {SocketIO} io - Socket.IO instance (optional, for real-time updates)
 */
export function setupChatState(app, io = null) {
  const router = express.Router();
  
  // Set global chat disabled state
  router.post('/disable-chat', (req, res) => {
    try {
      const { disabled } = req.body;
      
      // Validate input
      if (typeof disabled !== 'boolean') {
        return res.status(400).json({ 
          error: 'Invalid input: disabled must be a boolean' 
        });
      }
      
      // Update global state
      globalChatState = { chatDisabled: disabled };
      
      // Emit real-time update to all connected clients if Socket.IO is available
      if (io) {
        io.emit('chat-state-changed', globalChatState);
      }
      
      res.json({ success: true, chatDisabled: disabled });
    } catch (error) {
      console.error('Error updating chat state:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Get global chat state
  router.get('/chat-state', (req, res) => {
    try {
      res.json(globalChatState);
    } catch (error) {
      console.error('Error retrieving chat state:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Mount the router
  app.use('/api', router);
  
  // Setup Socket.IO handlers if available
  const setupSocketHandlers = (socket) => {
    // Send current chat state to newly connected client
    socket.emit('chat-state-changed', globalChatState);
    
    // Handle chat state requests from client
    socket.on('get-chat-state', () => {
      socket.emit('chat-state-changed', globalChatState);
    });
    
    // Handle chat state updates from client (if needed)
    socket.on('update-chat-state', (data) => {
      try {
        if (typeof data.disabled === 'boolean') {
          globalChatState = { chatDisabled: data.disabled };
          // Broadcast to all clients
          socket.broadcast.emit('chat-state-changed', globalChatState);
        }
      } catch (error) {
        console.error('Error handling chat state update:', error);
      }
    });
    
    return {
      handleDisconnect: () => {
        // Cleanup if needed
        console.log('Chat state handler disconnected for socket:', socket.id);
      }
    };
  };
  
  return {
    setupSocketHandlers,
    getChatState: () => globalChatState,
    setChatState: (newState) => {
      globalChatState = { ...globalChatState, ...newState };
      if (io) {
        io.emit('chat-state-changed', globalChatState);
      }
    }
  };
}