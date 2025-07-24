// modules/handRaising.js
export function setupHandRaising(app, io) {
  // Track meeting state
  let meetingState = {
    handRaisingEnabled: true
  };

  // API Routes
  app.get('/api/meeting-state', (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    res.json(meetingState);
  });

  app.post('/api/toggle-hand-raising', (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { enabled } = req.body;
    meetingState.handRaisingEnabled = enabled;
    
    // Broadcast to all connected clients
    io.emit('hand-raising-toggle', enabled);
    
    res.json({ success: true, handRaisingEnabled: enabled });
  });

  // Socket handlers setup function
  const setupSocketHandlers = (socket) => {
    console.log('Setting up hand raising handlers for socket:', socket.id);

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

    // Return cleanup function
    const handleDisconnect = () => {
      console.log('Hand raising cleanup for socket:', socket.id);
      // Add any specific cleanup logic here if needed
    };

    return { handleDisconnect };
  };

  // Return API object
  return {
    meetingState,
    setupSocketHandlers,
    getMeetingState: () => meetingState,
    setHandRaisingEnabled: (enabled) => {
      meetingState.handRaisingEnabled = enabled;
      io.emit('hand-raising-toggle', enabled);
    }
  };
}