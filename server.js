import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { setupDatabase, setupMiddleware } from './modules/config.js';
import { setupSession, setupAuthRoutes } from './modules/auth.js';
import { setupSocketIO } from './modules/call.js';
import { setupFileShare } from './modules/fileShare.js';
import { setupFilePermission } from './modules/filePermission.js';
import { setupChat } from './modules/chat.js';
import { setupPoll } from './modules/poll.js';
import { setupRecordingControl } from './modules/recordingControl.js';
import { setuprecording } from './modules/recording.js';
import { setupHandRaising } from './modules/handRaising.js'; // New import

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Setup middleware
setupMiddleware(app);

// Setup session
setupSession(app);

// Setup database
setupDatabase();

// Setup auth routes
setupAuthRoutes(app);

// Setup Socket.IO and meeting routes
const { io, setupMeetingRoutes } = setupSocketIO(server);
setupMeetingRoutes(app);

// Setup recording control functionality
const { recordingManager, setupSocketHandlers: setupRecordingSocketHandlers } = setupRecordingControl(app, io);

// Setup recording permission functionality
const { permissionManager, setupSocketHandlers: setuprecordingSocketHandlers } = setuprecording(app, io);

// Setup chat functionality
const { setupChatSocketHandlers } = setupChat(app, io);

// Setup file sharing functionality
const fileShareAPI = setupFileShare(app, io);

// Setup file permission functionality
const { permissionManager: filePermissionManager, setupSocketHandlers: setupFilePermissionSocketHandlers } = setupFilePermission(app, io);

// Setup poll functionality
const pollAPI = setupPoll(app, io);

// Setup hand raising functionality
const handRaisingAPI = setupHandRaising(app, io);

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Default route
app.get('/', (req, res) => {
  if (req.session.userId) {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
  } else {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  }
});

// Meeting host route
app.get('/host', (req, res) => {
  if (req.session.userId) {
    res.sendFile(path.join(__dirname, 'public', 'meetingHost.html'));
  } else {
    res.redirect('/');
  }
});

// Meeting join route
app.get('/join', (req, res) => {
  if (req.session.userId) {
    res.sendFile(path.join(__dirname, 'public', 'meetingJoin.html'));
  } else {
    res.redirect('/');
  }
});

// Chat route
app.get('/chat', (req, res) => {
  if (req.session.userId) {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
  } else {
    res.redirect('/');
  }
});

// File sharing dashboard route
app.get('/files', (req, res) => {
  if (req.session.userId) {
    res.sendFile(path.join(__dirname, 'public', 'files.html'));
  } else {
    res.redirect('/');
  }
});

// Poll dashboard route
app.get('/poll', (req, res) => {
  if (req.session.userId) {
    res.sendFile(path.join(__dirname, 'public', 'poll.html'));
  } else {
    res.redirect('/');
  }
});

// Recording control dashboard route
app.get('/recording', (req, res) => {
  if (req.session.userId) {
    res.sendFile(path.join(__dirname, 'public', 'recording.html'));
  } else {
    res.redirect('/');
  }
});

// Enhanced Socket.IO connection handling to include all functionality
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Setup chat handlers for this socket
  const { handleChatDisconnect } = setupChatSocketHandlers(socket);
  
  // Setup poll handlers for this socket
  const { handlePollDisconnect } = pollAPI.setupPollSocketHandlers(socket);
  
  // Setup recording control handlers for this socket
  const { handleDisconnect: handleRecordingDisconnect } = setupRecordingSocketHandlers(socket);
  
  // Setup recording permission handlers for this socket
  const { handleDisconnect: handlerecordingDisconnect } = setuprecordingSocketHandlers(socket);
  
  // Setup file permission handlers for this socket
  const { handleDisconnect: handleFilePermissionDisconnect } = setupFilePermissionSocketHandlers(socket);
  
  // Setup hand raising handlers for this socket
  const { handleDisconnect: handleHandRaisingDisconnect } = handRaisingAPI.setupSocketHandlers(socket);
  
  // Override the original disconnect handler to include all cleanup
  const originalDisconnectHandler = socket.listeners('disconnect')[0];
  socket.removeAllListeners('disconnect');
  
  socket.on('disconnect', () => {
    // Handle chat cleanup
    handleChatDisconnect();
    
    // Handle poll cleanup
    handlePollDisconnect();
    
    // Handle recording control cleanup
    handleRecordingDisconnect();
    
    // Handle recording permission cleanup
    handlerecordingDisconnect();
    
    // Handle file permission cleanup
    handleFilePermissionDisconnect();
    
    // Handle hand raising cleanup
    handleHandRaisingDisconnect();
    
    // Call original disconnect handler if it exists (from call.js)
    if (originalDisconnectHandler) {
      originalDisconnectHandler();
    }
    
    console.log('User disconnected:', socket.id);
  });
});

// Handle 404 errors
app.use((req, res) => {
    res.status(404).json({ error: 'Page not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Dashboard: http://localhost:${PORT}/`);
    console.log(`Host page: http://localhost:${PORT}/host`);
    console.log(`Join page: http://localhost:${PORT}/join`);
});