import express from 'express';
import http from 'http';
import { Server as socketIo } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// __dirname workaround for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'meetingHost.html'));
});

app.get('/host', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'meetingHost.html'));
});

app.get('/join', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'meetingJoin.html'));
});

// Track meeting state
let meetingState = {
  handRaisingEnabled: true
};

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Send current state to newly connected client
  socket.emit('meeting-state', meetingState);

  // Handle hand raising toggle from host
  socket.on('toggle-hand-raising', (enabled) => {
    meetingState.handRaisingEnabled = enabled;
    console.log('Hand raising toggled:', enabled);

    // Broadcast to all connected clients
    io.emit('hand-raising-toggle', enabled);
  });

  // Handle host identification
  socket.on('identify-as-host', () => {
    socket.join('hosts');
    console.log('Host identified:', socket.id);
  });

  // Handle participant identification
  socket.on('identify-as-participant', () => {
    socket.join('participants');
    console.log('Participant joined:', socket.id);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Host page: http://localhost:${PORT}/host`);
  console.log(`Join page: http://localhost:${PORT}/join`);
});
