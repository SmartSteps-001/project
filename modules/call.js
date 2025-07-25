import { Server as SocketIO } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { authenticateUser } from './auth.js';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Meeting class to manage meeting state
class Meeting {
  constructor(id, hostId, hostName) {
    this.id = id;
    this.hostId = hostId;
    this.hostName = hostName;
    this.participants = new Map();
    this.coHosts = new Set();
    this.spotlightedParticipant = null;
    this.screenShares = new Map();
    this.createdAt = new Date();
    this.autoSpotlightEnabled = true;
    this.manualSpotlight = false;
    this.raisedHands = new Set();
    this.iceServers = this.getICEServers();
    this.isLocked = false; // New property for meeting lock status
    this.permissions = {
      chatEnabled: true,
      fileSharing: true,
      emojiReactions: true,
      allowRename: true,
      allowUnmute: true,
      allowHandRaising: true,
      muteAllParticipants: false
    };
  }

  getICEServers() {
    // Enhanced ICE servers configuration for production
    const iceServers = [
      // Google STUN servers
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      
      // Additional STUN servers for better connectivity
      { urls: 'stun:stun.stunprotocol.org:3478' },
      { urls: 'stun:stun.nextcloud.com:443' },
      { urls: 'stun:stun.sipgate.net:3478' },
      { urls: 'stun:stun.ekiga.net' },
      
      // Multiple TURN server providers for better reliability
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      // Add more reliable TURN servers
      {
        urls: 'turn:relay1.expressturn.com:3478',
        username: 'ef3I7ZYQ1XQZAHK32F',
        credential: 'lL2xX9qQCkH6QzRU'
      },
      {
        urls: 'turn:a.relay.metered.ca:80',
        username: 'a40c38b0e78216200d619b80',
        credential: 'dvWS61aEZmhNcJaS'
      },
      {
        urls: 'turn:a.relay.metered.ca:80?transport=tcp',
        username: 'a40c38b0e78216200d619b80',
        credential: 'dvWS61aEZmhNcJaS'
      },
      {
        urls: 'turn:a.relay.metered.ca:443',
        username: 'a40c38b0e78216200d619b80',
        credential: 'dvWS61aEZmhNcJaS'
      },
      {
        urls: 'turn:a.relay.metered.ca:443?transport=tcp',
        username: 'a40c38b0e78216200d619b80',
        credential: 'dvWS61aEZmhNcJaS'
      }
    ];

    // Add environment-based TURN servers if available
    if (process.env.TURN_SERVER_URL && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
      iceServers.push({
        urls: process.env.TURN_SERVER_URL,
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL
      });
    }

    return iceServers;
  }

  addParticipant(socketId, name, isHost = false) {
    const participant = {
      socketId,
      name,
      isHost,
      isCoHost: false,
      isMuted: false,
      isCameraOff: false,
      isSpotlighted: false,
      isScreenSharing: false,
      audioLevel: 0,
      joinedAt: new Date(),
      isReady: false,
      handRaised: false,
      connectionState: 'new'
    };
    
    this.participants.set(socketId, participant);
    
    if (isHost && !this.spotlightedParticipant) {
      this.spotlightParticipant(socketId);
    }
    
    return participant;
  }

  removeParticipant(socketId) {
    this.participants.delete(socketId);
    this.coHosts.delete(socketId);
    this.screenShares.delete(socketId);
    this.raisedHands.delete(socketId);
    
    if (this.spotlightedParticipant === socketId) {
      this.spotlightedParticipant = null;
      this.manualSpotlight = false;
    }
  }

  setParticipantReady(socketId) {
    const participant = this.participants.get(socketId);
    if (participant) {
      participant.isReady = true;
      participant.connectionState = 'ready';
    }
  }

  updateParticipantConnectionState(socketId, state) {
    const participant = this.participants.get(socketId);
    if (participant) {
      participant.connectionState = state;
    }
  }

  getReadyParticipants() {
    return Array.from(this.participants.values()).filter(p => p.isReady);
  }

  makeCoHost(socketId) {
    const participant = this.participants.get(socketId);
    if (participant && !participant.isHost) {
      participant.isCoHost = true;
      this.coHosts.add(socketId);
    }
  }

  removeCoHost(socketId) {
    const participant = this.participants.get(socketId);
    if (participant) {
      participant.isCoHost = false;
      this.coHosts.delete(socketId);
    }
  }

  spotlightParticipant(socketId) {
    if (this.spotlightedParticipant) {
      const prevSpotlighted = this.participants.get(this.spotlightedParticipant);
      if (prevSpotlighted) {
        prevSpotlighted.isSpotlighted = false;
      }
    }

    const participant = this.participants.get(socketId);
    if (participant) {
      participant.isSpotlighted = true;
      this.spotlightedParticipant = socketId;
      this.manualSpotlight = true;
    }
  }

  removeSpotlight() {
    if (this.spotlightedParticipant) {
      const participant = this.participants.get(this.spotlightedParticipant);
      if (participant) {
        participant.isSpotlighted = false;
      }
      this.spotlightedParticipant = null;
      this.manualSpotlight = false;
    }
  }

  handleAudioActivity(socketId, audioLevel) {
    const participant = this.participants.get(socketId);
    if (participant) {
      participant.audioLevel = audioLevel;
      
      if (!this.manualSpotlight && this.autoSpotlightEnabled && audioLevel > 0.3) {
        if (this.spotlightedParticipant !== socketId) {
          this.spotlightParticipant(socketId);
          this.manualSpotlight = false;
          return true;
        }
      }
    }
    return false;
  }

  addScreenShare(socketId, streamId) {
    this.screenShares.set(socketId, {
      streamId,
      startedAt: new Date(),
      hasComputerAudio: false
    });
    
    const participant = this.participants.get(socketId);
    if (participant) {
      participant.isScreenSharing = true;
    }
  }

  // Enhanced method to support computer audio
  addScreenShare(socketId, streamId, hasComputerAudio = false) {
    this.screenShares.set(socketId, {
      streamId,
      startedAt: new Date(),
      hasComputerAudio
    });
    
    const participant = this.participants.get(socketId);
    if (participant) {
      participant.isScreenSharing = true;
      participant.isSharingComputerAudio = hasComputerAudio;
    }
  }

  removeScreenShare(socketId) {
    this.screenShares.delete(socketId);
    const participant = this.participants.get(socketId);
    if (participant) {
      participant.isScreenSharing = false;
      participant.isSharingComputerAudio = false;
    }
  }

  raiseHand(socketId) {
    this.raisedHands.add(socketId);
    const participant = this.participants.get(socketId);
    if (participant) {
      participant.handRaised = true;
    }
  }

  lowerHand(socketId) {
    this.raisedHands.delete(socketId);
    const participant = this.participants.get(socketId);
    if (participant) {
      participant.handRaised = false;
    }
  }

  getRaisedHands() {
    return Array.from(this.raisedHands);
  }

  canPerformHostAction(socketId) {
    const participant = this.participants.get(socketId);
    return participant && (participant.isHost || participant.isCoHost);
  }

  canMakeCoHost(socketId) {
    const participant = this.participants.get(socketId);
    return participant && participant.isHost;
  }

  // New methods for meeting lock functionality
  lockMeeting() {
    this.isLocked = true;
  }

  unlockMeeting() {
    this.isLocked = false;
  }

  // Enhanced methods for permission management
  updatePermissions(permissions) {
    this.permissions = { ...this.permissions, ...permissions };
    
    // If mute all participants is enabled, mute everyone except host
    if (permissions.muteAllParticipants) {
      this.participants.forEach((participant, socketId) => {
        if (!participant.isHost) {
          participant.isMuted = true;
        }
      });
    }
  }

  getPermissions() {
    return this.permissions;
  }

  isParticipantAllowed(socketId) {
    // Allow if meeting is not locked or if participant is already in the meeting
    return !this.isLocked || this.participants.has(socketId);
  }

  // Enhanced rename participant method with better validation
  renameParticipant(socketId, newName) {
    const participant = this.participants.get(socketId);
    if (!participant) return null;

    // Validate name
    if (!newName || typeof newName !== 'string') return null;
    if (newName.trim().length === 0 || newName.trim().length > 50) return null;

    const oldName = participant.name;
    participant.name = newName.trim();
    
    return { oldName, newName: participant.name };
  }

  // Check if participant can rename themselves
  canRename(socketId) {
    const participant = this.participants.get(socketId);
    if (!participant) return false;
    
    // Host can always rename themselves
    if (participant.isHost) return true;
    
    // Participants can rename if permission is granted
    return this.permissions.allowRename;
  }

  // Check if participant can unmute themselves
  canUnmute(socketId) {
    const participant = this.participants.get(socketId);
    if (!participant) return false;
    
    // Host can always unmute
    if (participant.isHost) return true;
    
    // Check if mute all is enabled
    if (this.permissions.muteAllParticipants) return false;
    
    // Participants can unmute if permission is granted
    return this.permissions.allowUnmute;
  }

  // Check if participant can raise hand
  canRaiseHand(socketId) {
    const participant = this.participants.get(socketId);
    if (!participant) return false;
    
    return this.permissions.allowHandRaising;
  }
}

// Store meeting data
const meetings = new Map();
const participants = new Map();

export const setupSocketIO = (server) => {
  const io = new SocketIO(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 120000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    allowEIO3: true
  });

  // Meeting routes
  const setupMeetingRoutes = (app) => {
    app.get('/host/:meetingId', authenticateUser, (req, res) => {
      res.sendFile(path.join(__dirname, '../public', 'meetingHost.html'));
    });

    app.get('/join/:meetingId', authenticateUser, (req, res) => {
      const { meetingId } = req.params;
      const meeting = meetings.get(meetingId);
      
      // Check if meeting exists and is locked
      if (meeting && meeting.isLocked) {
        // Return a special locked page instead of the normal join page
        res.sendFile(path.join(__dirname, '../public', 'meetingLocked.html'));
        return;
      }
      
      res.sendFile(path.join(__dirname, '../public', 'meetingJoin.html'));
    });

    app.post('/api/create-meeting', authenticateUser, (req, res) => {
      const meetingId = uuidv4().substring(0, 8).toUpperCase();
      
      res.json({ 
        meetingId,
        hostUrl: `/host/${meetingId}`,
        joinUrl: `/join/${meetingId}`
      });
    });

    app.get('/api/meeting/:meetingId', authenticateUser, (req, res) => {
      const { meetingId } = req.params;
      const meeting = meetings.get(meetingId);
      
      if (!meeting) {
        return res.status(404).json({ error: 'Meeting not found' });
      }

      res.json({
        id: meeting.id,
        hostName: meeting.hostName,
        participantCount: meeting.participants.size,
        createdAt: meeting.createdAt,
        isLocked: meeting.isLocked,
        permissions: meeting.getPermissions()
      });
    });

    // ICE servers endpoint for clients
    app.get('/api/ice-servers', authenticateUser, (req, res) => {
      const iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:stun.stunprotocol.org:3478' },
        { urls: 'stun:stun.nextcloud.com:443' },
        { urls: 'stun:stun.sipgate.net:3478' },
        { urls: 'stun:stun.ekiga.net' },
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:relay1.expressturn.com:3478',
          username: 'ef3I7ZYQ1XQZAHK32F',
          credential: 'lL2xX9qQCkH6QzRU'
        },
        {
          urls: 'turn:a.relay.metered.ca:80',
          username: 'a40c38b0e78216200d619b80',
          credential: 'dvWS61aEZmhNcJaS'
        },
        {
          urls: 'turn:a.relay.metered.ca:80?transport=tcp',
          username: 'a40c38b0e78216200d619b80',
          credential: 'dvWS61aEZmhNcJaS'
        },
        {
          urls: 'turn:a.relay.metered.ca:443',
          username: 'a40c38b0e78216200d619b80',
          credential: 'dvWS61aEZmhNcJaS'
        },
        {
          urls: 'turn:a.relay.metered.ca:443?transport=tcp',
          username: 'a40c38b0e78216200d619b80',
          credential: 'dvWS61aEZmhNcJaS'
        }
      ];

      // Add environment-based TURN servers if available
      if (process.env.TURN_SERVER_URL && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
        iceServers.push({
          urls: process.env.TURN_SERVER_URL,
          username: process.env.TURN_USERNAME,
          credential: process.env.TURN_CREDENTIAL
        });
      }

      res.json({ iceServers });
    });
  };

  // Socket.IO connection handling
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
// ADD THIS EVENT HANDLER TO YOUR SOCKET CONNECTION HANDLING IN call.js
// Place this with your other socket event handlers (around line 800-900)

socket.on('change-participant-name', (data) => {
  const { newName, oldName } = data;
  const participantInfo = participants.get(socket.id);
  
  if (!participantInfo) {
    socket.emit('action-error', { message: 'Participant not found' });
    return;
  }
  
  const meeting = meetings.get(participantInfo.meetingId);
  if (!meeting) {
    socket.emit('action-error', { message: 'Meeting not found' });
    return;
  }

  const participant = meeting.participants.get(socket.id);
  if (!participant) {
    socket.emit('action-error', { message: 'Participant not found in meeting' });
    return;
  }

  // Check if participant can rename themselves
  if (!meeting.canRename(socket.id)) {
    socket.emit('action-error', { message: 'You are not allowed to rename yourself' });
    return;
  }

  // Validate name
  if (!newName || newName.trim().length === 0) {
    socket.emit('action-error', { message: 'Please enter a valid name' });
    return;
  }
  
  if (newName.length > 50) {
    socket.emit('action-error', { message: 'Name is too long (max 50 characters)' });
    return;
  }
  
  // Check if name is already taken
  const trimmedName = newName.trim();
  const nameExists = Array.from(meeting.participants.values())
    .some(p => p.name.toLowerCase() === trimmedName.toLowerCase() && p.socketId !== socket.id);
    
  if (nameExists) {
    socket.emit('action-error', { message: 'This name is already taken by another participant' });
    return;
  }
  
  // Update participant name
  const currentName = participant.name;
  participant.name = trimmedName;
  
  // If it's the host, also update the meeting host name
  if (participant.isHost) {
    meeting.hostName = trimmedName;
  }
  
  console.log(`Participant ${socket.id} renamed from ${currentName} to ${trimmedName} in meeting ${participantInfo.meetingId}`);
  
  // Broadcast the name change to all participants in the meeting using the existing event
  io.to(participantInfo.meetingId).emit('participant-renamed', {
    socketId: socket.id,
    oldName: currentName,
    newName: trimmedName,
    participants: Array.from(meeting.participants.values()),
    isHost: participant.isHost
  });
});

// ALSO UPDATE THE EXISTING rename-participant EVENT HANDLER
// Find the existing 'rename-participant' event handler and replace it with this:

socket.on('rename-participant', (data) => {
  const { newName } = data;
  const participantInfo = participants.get(socket.id);
  
  if (!participantInfo) {
    socket.emit('action-error', { message: 'Participant not found' });
    return;
  }
  
  const meeting = meetings.get(participantInfo.meetingId);
  if (!meeting) {
    socket.emit('action-error', { message: 'Meeting not found' });
    return;
  }

  // Check if participant can rename themselves
  if (!meeting.canRename(socket.id)) {
    socket.emit('action-error', { message: 'You are not allowed to rename yourself' });
    return;
  }

  // Validate name
  if (!newName || newName.trim().length === 0 || newName.trim().length > 50) {
    socket.emit('action-error', { message: 'Invalid name. Name must be 1-50 characters.' });
    return;
  }

  // Check for duplicate names
  const trimmedName = newName.trim();
  const existingParticipant = Array.from(meeting.participants.values())
    .find(p => p.name.toLowerCase() === trimmedName.toLowerCase() && p.socketId !== socket.id);
  
  if (existingParticipant) {
    socket.emit('action-error', { message: 'This name is already taken by another participant' });
    return;
  }

  const result = meeting.renameParticipant(socket.id, trimmedName);
  if (result) {
    // Notify all participants about the name change
    io.to(participantInfo.meetingId).emit('participant-renamed', {
      socketId: socket.id,
      oldName: result.oldName,
      newName: result.newName,
      participants: Array.from(meeting.participants.values()),
      isHost: false
    });

    console.log(`Participant ${socket.id} renamed from ${result.oldName} to ${result.newName} in meeting ${participantInfo.meetingId}`);
  } else {
    socket.emit('action-error', { message: 'Failed to rename participant' });
  }
});
    socket.on('join-as-host', (data) => {
      const { meetingId, hostName } = data;
      
      const meeting = new Meeting(meetingId, socket.id, hostName);
      meetings.set(meetingId, meeting);
      
      meeting.addParticipant(socket.id, hostName, true);
      
      socket.join(meetingId);
      
      participants.set(socket.id, { meetingId, isHost: true });
      
      socket.emit('joined-meeting', {
        meetingId,
        isHost: true,
        participants: Array.from(meeting.participants.values()),
        spotlightedParticipant: meeting.spotlightedParticipant,
        raisedHands: meeting.getRaisedHands(),
        iceServers: meeting.iceServers,
        isLocked: meeting.isLocked,
        permissions: meeting.getPermissions()
      });

      console.log(`Host ${hostName} created meeting ${meetingId}`);
    });

    socket.on('join-meeting', (data) => {
      const { meetingId, participantName } = data;
      const meeting = meetings.get(meetingId);
      
      if (!meeting) {
        socket.emit('meeting-error', { message: 'Meeting not found' });
        return;
      }

      // Check if meeting is locked and participant is not already in the meeting
      if (meeting.isLocked && !meeting.participants.has(socket.id)) {
        socket.emit('meeting-locked', { 
          message: 'The host disabled New Entries, Meeting Inaccessible',
          meetingId: meetingId
        });
        return;
      }

      meeting.addParticipant(socket.id, participantName);
      
      socket.join(meetingId);
      
      participants.set(socket.id, { meetingId, isHost: false });
      
      socket.emit('joined-meeting', {
        meetingId,
        isHost: false,
        participants: Array.from(meeting.participants.values()),
        spotlightedParticipant: meeting.spotlightedParticipant,
        screenShares: Array.from(meeting.screenShares.entries()),
        raisedHands: meeting.getRaisedHands(),
        iceServers: meeting.iceServers,
        isLocked: meeting.isLocked,
        permissions: meeting.getPermissions()
      });

      socket.to(meetingId).emit('participant-joined', {
        participant: meeting.participants.get(socket.id),
        participants: Array.from(meeting.participants.values())
      });

      console.log(`Participant ${participantName} joined meeting ${meetingId}`);
    });

    // New socket event for locking/unlocking meeting
    socket.on('toggle-meeting-lock', (data) => {
      const { isLocked } = data;
      const participantInfo = participants.get(socket.id);
      
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting || !meeting.canPerformHostAction(socket.id)) {
        socket.emit('action-error', { message: 'Only host can lock/unlock the meeting' });
        return;
      }

      if (isLocked) {
        meeting.lockMeeting();
      } else {
        meeting.unlockMeeting();
      }

      // Notify all participants about the lock status change
      io.to(participantInfo.meetingId).emit('meeting-lock-changed', {
        isLocked: meeting.isLocked,
        changedBy: meeting.participants.get(socket.id)?.name
      });

      console.log(`Meeting ${participantInfo.meetingId} ${isLocked ? 'locked' : 'unlocked'} by ${socket.id}`);
    });

    // Enhanced update-meeting-permissions event
    socket.on('update-meeting-permissions', (data) => {
      const { permissions } = data;
      const participantInfo = participants.get(socket.id);
      
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting || !meeting.canPerformHostAction(socket.id)) {
        socket.emit('action-error', { message: 'Only host can update meeting permissions' });
        return;
      }

      meeting.updatePermissions(permissions);

      // Notify all participants about the permission changes
      io.to(participantInfo.meetingId).emit('meeting-permissions-updated', {
        permissions: meeting.getPermissions(),
        changedBy: meeting.participants.get(socket.id)?.name,
        participants: Array.from(meeting.participants.values())
      });

      // If rename permission was changed, send specific update
      if (permissions.hasOwnProperty('allowRename')) {
        io.to(participantInfo.meetingId).emit('rename-permission-updated', {
          permissions: { allowRename: permissions.allowRename },
          changedBy: meeting.participants.get(socket.id)?.name
        });
      }

      console.log(`Meeting ${participantInfo.meetingId} permissions updated by ${socket.id}:`, permissions);
    });

    socket.on('participant-ready', () => {
      const participantInfo = participants.get(socket.id);
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting) return;

      meeting.setParticipantReady(socket.id);
      
      const readyParticipants = meeting.getReadyParticipants();
      
      // Create connections with all ready participants
      readyParticipants.forEach(participant => {
        if (participant.socketId !== socket.id) {
          // Send connection initiation to both parties
          io.to(participant.socketId).emit('initiate-connection', {
            targetSocketId: socket.id,
            shouldCreateOffer: true,
            iceServers: meeting.iceServers
          });
          
          socket.emit('initiate-connection', {
            targetSocketId: participant.socketId,
            shouldCreateOffer: false,
            iceServers: meeting.iceServers
          });
        }
      });

      console.log(`Participant ${socket.id} is ready for WebRTC connections`);
    });

    socket.on('connection-state-change', (data) => {
      const { targetSocketId, state } = data;
      const participantInfo = participants.get(socket.id);
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting) return;

      meeting.updateParticipantConnectionState(socket.id, state);
      
      // Notify the target about connection state
      io.to(targetSocketId).emit('peer-connection-state', {
        fromSocketId: socket.id,
        state: state
      });

      console.log(`Connection state between ${socket.id} and ${targetSocketId}: ${state}`);
    });

    socket.on('offer', (data) => {
      console.log(`Offer from ${socket.id} to ${data.target}`);
      socket.to(data.target).emit('offer', {
        offer: data.offer,
        sender: socket.id
      });
    });

    socket.on('answer', (data) => {
      console.log(`Answer from ${socket.id} to ${data.target}`);
      socket.to(data.target).emit('answer', {
        answer: data.answer,
        sender: socket.id
      });
    });

    socket.on('ice-candidate', (data) => {
      console.log(`ICE candidate from ${socket.id} to ${data.target}`);
      socket.to(data.target).emit('ice-candidate', {
        candidate: data.candidate,
        sender: socket.id
      });
    });

    socket.on('connection-failed', (data) => {
      const { targetSocketId } = data;
      console.log(`Connection failed between ${socket.id} and ${targetSocketId}, attempting restart`);
      
      // Trigger connection restart
      socket.emit('restart-connection', {
        targetSocketId: targetSocketId
      });
      
      socket.to(targetSocketId).emit('restart-connection', {
        targetSocketId: socket.id
      });
    });

    socket.on('audio-level', (data) => {
      const participantInfo = participants.get(socket.id);
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting) return;

      const spotlightChanged = meeting.handleAudioActivity(socket.id, data.level);
      
      if (spotlightChanged) {
        io.to(participantInfo.meetingId).emit('participant-spotlighted', {
          spotlightedParticipant: meeting.spotlightedParticipant,
          participants: Array.from(meeting.participants.values()),
          reason: 'audio-activity'
        });
      }
    });

    socket.on('send-reaction', (data) => {
      const participantInfo = participants.get(socket.id);
      if (!participantInfo) return;

      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting) return;

      // Check if emoji reactions are enabled
      if (!meeting.permissions.emojiReactions) {
        socket.emit('action-error', { message: 'Emoji reactions are disabled by the host' });
        return;
      }

      const participant = meeting.participants.get(socket.id);
      if (!participant) return;

      io.to(participantInfo.meetingId).emit('reaction-received', {
        emoji: data.emoji,
        participantName: participant.name,
        socketId: socket.id,
        timestamp: data.timestamp
      });

      console.log(`Reaction ${data.emoji} sent by ${participant.name} in meeting ${participantInfo.meetingId}`);
    });

    socket.on('raise-hand', () => {
      const participantInfo = participants.get(socket.id);
      if (!participantInfo) return;

      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting) return;

      // Check if hand raising is enabled
      if (!meeting.canRaiseHand(socket.id)) {
        socket.emit('action-error', { message: 'Hand raising is disabled by the host' });
        return;
      }

      const participant = meeting.participants.get(socket.id);
      if (!participant) return;

      meeting.raiseHand(socket.id);

      io.to(participantInfo.meetingId).emit('hand-raised', {
        socketId: socket.id,
        participantName: participant.name,
        raisedHands: meeting.getRaisedHands()
      });

      console.log(`${participant.name} raised hand in meeting ${participantInfo.meetingId}`);
    });

    socket.on('lower-hand', () => {
      const participantInfo = participants.get(socket.id);
      if (!participantInfo) return;

      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting) return;

      const participant = meeting.participants.get(socket.id);
      if (!participant) return;

      meeting.lowerHand(socket.id);

      io.to(participantInfo.meetingId).emit('hand-lowered', {
        socketId: socket.id,
        participantName: participant.name,
        raisedHands: meeting.getRaisedHands()
      });

      console.log(`${participant.name} lowered hand in meeting ${participantInfo.meetingId}`);
    });

    socket.on('start-screen-share', (data) => {
      const participantInfo = participants.get(socket.id);
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting) return;

      // Enhanced screen share with computer audio support
      meeting.addScreenShare(socket.id, data.streamId, data.hasComputerAudio || false);
      
      socket.to(participantInfo.meetingId).emit('screen-share-started', {
        participantId: socket.id,
        streamId: data.streamId,
        participantName: meeting.participants.get(socket.id)?.name,
        hasComputerAudio: data.hasComputerAudio || false
      });

      console.log(`Screen share started by ${socket.id} in meeting ${participantInfo.meetingId}`);
    });

    socket.on('stop-screen-share', () => {
      const participantInfo = participants.get(socket.id);
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting) return;

      meeting.removeScreenShare(socket.id);
      
      socket.to(participantInfo.meetingId).emit('screen-share-stopped', {
        participantId: socket.id
      });

      console.log(`Screen share stopped by ${socket.id} in meeting ${participantInfo.meetingId}`);
    });

    // New event for computer audio during screen share
    socket.on('toggle-computer-audio', (data) => {
      const { enabled } = data;
      const participantInfo = participants.get(socket.id);
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting) return;

      const participant = meeting.participants.get(socket.id);
      if (participant && participant.isScreenSharing) {
        participant.isSharingComputerAudio = enabled;
        
        // Update screen share info
        const screenShare = meeting.screenShares.get(socket.id);
        if (screenShare) {
          screenShare.hasComputerAudio = enabled;
        }
        
        // Notify all participants about computer audio toggle
        socket.to(participantInfo.meetingId).emit('computer-audio-toggled', {
          participantId: socket.id,
          enabled,
          participantName: participant.name
        });

        console.log(`Computer audio ${enabled ? 'enabled' : 'disabled'} by ${socket.id} in meeting ${participantInfo.meetingId}`);
      }
    });

    // New event for computer audio level during screen share
    socket.on('computer-audio-level', (data) => {
      const { level } = data;
      const participantInfo = participants.get(socket.id);
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting) return;

      const participant = meeting.participants.get(socket.id);
      if (participant && participant.isScreenSharing && participant.isSharingComputerAudio) {
        // Broadcast computer audio level to other participants
        socket.to(participantInfo.meetingId).emit('computer-audio-level-update', {
          participantId: socket.id,
          level,
          participantName: participant.name
        });
      }
    });
    socket.on('spotlight-participant', (data) => {
      const { targetSocketId } = data;
      const participantInfo = participants.get(socket.id);
      
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting || !meeting.canPerformHostAction(socket.id)) {
        socket.emit('action-error', { message: 'Insufficient permissions' });
        return;
      }

      meeting.spotlightParticipant(targetSocketId);
      
      io.to(participantInfo.meetingId).emit('participant-spotlighted', {
        spotlightedParticipant: targetSocketId,
        participants: Array.from(meeting.participants.values()),
        reason: 'manual'
      });

      console.log(`Participant ${targetSocketId} spotlighted in meeting ${participantInfo.meetingId}`);
    });

    socket.on('remove-spotlight', () => {
      const participantInfo = participants.get(socket.id);
      
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting || !meeting.canPerformHostAction(socket.id)) {
        socket.emit('action-error', { message: 'Insufficient permissions' });
        return;
      }

      meeting.removeSpotlight();
      
      io.to(participantInfo.meetingId).emit('spotlight-removed', {
        participants: Array.from(meeting.participants.values())
      });

      console.log(`Spotlight removed in meeting ${participantInfo.meetingId}`);
    });

    socket.on('pin-participant', (data) => {
      const { targetSocketId } = data;
      const participantInfo = participants.get(socket.id);
      
      if (!participantInfo) return;
      
      socket.emit('participant-pinned', {
        pinnedParticipant: targetSocketId
      });

      console.log(`Participant ${socket.id} pinned ${targetSocketId}`);
    });

    socket.on('mute-participant', (data) => {
      const { targetSocketId } = data;
      const participantInfo = participants.get(socket.id);
      
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting || !meeting.canPerformHostAction(socket.id)) {
        socket.emit('action-error', { message: 'Insufficient permissions' });
        return;
      }

      const targetParticipant = meeting.participants.get(targetSocketId);
      if (targetParticipant) {
        targetParticipant.isMuted = !targetParticipant.isMuted;
        
        io.to(targetSocketId).emit('force-mute', {
          isMuted: targetParticipant.isMuted
        });
        
        io.to(participantInfo.meetingId).emit('participant-muted', {
          targetSocketId,
          isMuted: targetParticipant.isMuted,
          participants: Array.from(meeting.participants.values())
        });

        console.log(`Participant ${targetSocketId} ${targetParticipant.isMuted ? 'muted' : 'unmuted'} in meeting ${participantInfo.meetingId}`);
      }
    });

    socket.on('make-cohost', (data) => {
      const { targetSocketId } = data;
      const participantInfo = participants.get(socket.id);
      
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting || !meeting.canMakeCoHost(socket.id)) {
        socket.emit('action-error', { message: 'Only host can make co-hosts' });
        return;
      }

      meeting.makeCoHost(targetSocketId);
      
      io.to(targetSocketId).emit('made-cohost');
      
      io.to(participantInfo.meetingId).emit('cohost-assigned', {
        targetSocketId,
        participants: Array.from(meeting.participants.values())
      });

      console.log(`Participant ${targetSocketId} made co-host in meeting ${participantInfo.meetingId}`);
    });

    socket.on('kick-participant', (data) => {
      const { targetSocketId } = data;
      const participantInfo = participants.get(socket.id);
      
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting) return;

      const requester = meeting.participants.get(socket.id);
      const target = meeting.participants.get(targetSocketId);
      
      if (!requester || !target) return;
      
      if (!requester.isHost || target.isCoHost) {
        socket.emit('action-error', { message: 'Cannot kick this participant' });
        return;
      }

      meeting.removeParticipant(targetSocketId);
      participants.delete(targetSocketId);
      
      io.to(targetSocketId).emit('kicked-from-meeting');
      
      socket.to(participantInfo.meetingId).emit('participant-kicked', {
        targetSocketId,
        participants: Array.from(meeting.participants.values())
      });

      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.leave(participantInfo.meetingId);
        targetSocket.disconnect();
      }

      console.log(`Participant ${targetSocketId} kicked from meeting ${participantInfo.meetingId}`);
    });

    socket.on('toggle-mic', (data) => {
      const { isMuted } = data;
      const participantInfo = participants.get(socket.id);
      
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting) return;

      const participant = meeting.participants.get(socket.id);
      if (participant) {
        // Check if participant can unmute themselves
        if (isMuted === false && !meeting.canUnmute(socket.id)) {
          socket.emit('action-error', { message: 'You are not allowed to unmute yourself' });
          return;
        }
        
        participant.isMuted = isMuted;
        
        socket.to(participantInfo.meetingId).emit('participant-audio-changed', {
          socketId: socket.id,
          isMuted,
          participants: Array.from(meeting.participants.values())
        });
      }
    });

    socket.on('toggle-camera', (data) => {
      const { isCameraOff } = data;
      const participantInfo = participants.get(socket.id);
      
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting) return;

      const participant = meeting.participants.get(socket.id);
      if (participant) {
        participant.isCameraOff = isCameraOff;
        
        socket.to(participantInfo.meetingId).emit('participant-video-changed', {
          socketId: socket.id,
          isCameraOff,
          participants: Array.from(meeting.participants.values())
        });
      }
    });

    // Enhanced rename-participant event
    socket.on('rename-participant', (data) => {
      const { newName } = data;
      const participantInfo = participants.get(socket.id);
      
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting) return;

      // Check if participant can rename themselves
      if (!meeting.canRename(socket.id)) {
        socket.emit('action-error', { message: 'You are not allowed to rename yourself' });
        return;
      }

      // Validate name
      if (!newName || newName.trim().length === 0 || newName.trim().length > 50) {
        socket.emit('action-error', { message: 'Invalid name. Name must be 1-50 characters.' });
        return;
      }

      // Check for duplicate names
      const trimmedName = newName.trim();
      const existingParticipant = Array.from(meeting.participants.values())
        .find(p => p.name.toLowerCase() === trimmedName.toLowerCase() && p.socketId !== socket.id);
      
      if (existingParticipant) {
        socket.emit('action-error', { message: 'This name is already taken by another participant' });
        return;
      }

      const result = meeting.renameParticipant(socket.id, trimmedName);
      if (result) {
        // Notify all participants about the name change
        io.to(participantInfo.meetingId).emit('participant-renamed', {
          socketId: socket.id,
          oldName: result.oldName,
          newName: result.newName,
          participants: Array.from(meeting.participants.values()),
          isHost: false
        });

        console.log(`Participant ${socket.id} renamed from ${result.oldName} to ${result.newName} in meeting ${participantInfo.meetingId}`);
      }
    });

    // New socket event for host to rename any participant
    socket.on('host-rename-participant', (data) => {
      const { targetSocketId, newName } = data;
      const participantInfo = participants.get(socket.id);
      
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting || !meeting.canPerformHostAction(socket.id)) {
        socket.emit('action-error', { message: 'Only host can rename participants' });
        return;
      }

      // Validate name
      if (!newName || newName.trim().length === 0 || newName.trim().length > 50) {
        socket.emit('action-error', { message: 'Invalid name. Name must be 1-50 characters.' });
        return;
      }

      // Check for duplicate names
      const trimmedName = newName.trim();
      const existingParticipant = Array.from(meeting.participants.values())
        .find(p => p.name.toLowerCase() === trimmedName.toLowerCase() && p.socketId !== targetSocketId);
      
      if (existingParticipant) {
        socket.emit('action-error', { message: 'This name is already taken by another participant' });
        return;
      }

      const result = meeting.renameParticipant(targetSocketId, trimmedName);
      if (result) {
        // Notify all participants about the name change
        io.to(participantInfo.meetingId).emit('participant-renamed', {
          socketId: targetSocketId,
          oldName: result.oldName,
          newName: result.newName,
          participants: Array.from(meeting.participants.values()),
          renamedBy: meeting.participants.get(socket.id)?.name
        });

        console.log(`Host ${socket.id} renamed participant ${targetSocketId} from ${result.oldName} to ${result.newName} in meeting ${participantInfo.meetingId}`);
      }
    });

    // Enhanced host-rename-self event
    socket.on('host-rename-self', (data) => {
      const { newName } = data;
      const participantInfo = participants.get(socket.id);
      
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting) return;

      const participant = meeting.participants.get(socket.id);
      if (!participant || !participant.isHost) {
        socket.emit('action-error', { message: 'Only host can use this feature' });
        return;
      }

      // Validate name
      if (!newName || newName.trim().length === 0 || newName.trim().length > 50) {
        socket.emit('action-error', { message: 'Invalid name. Name must be 1-50 characters.' });
        return;
      }

      // Check for duplicate names
      const trimmedName = newName.trim();
      const existingParticipant = Array.from(meeting.participants.values())
        .find(p => p.name.toLowerCase() === trimmedName.toLowerCase() && p.socketId !== socket.id);
      
      if (existingParticipant) {
        socket.emit('action-error', { message: 'This name is already taken by another participant' });
        return;
      }

      const result = meeting.renameParticipant(socket.id, trimmedName);
      if (result) {
        // Update host name in meeting object
        meeting.hostName = trimmedName;
        
        // Notify all participants about the host name change
        io.to(participantInfo.meetingId).emit('participant-renamed', {
          socketId: socket.id,
          oldName: result.oldName,
          newName: result.newName,
          participants: Array.from(meeting.participants.values()),
          isHost: true
        });

        console.log(`Host ${socket.id} renamed themselves from ${result.oldName} to ${result.newName} in meeting ${participantInfo.meetingId}`);
      }
    });

    // New socket event for muting all participants
    socket.on('mute-all-participants', (data) => {
      const { muteAll } = data;
      const participantInfo = participants.get(socket.id);
      
      if (!participantInfo) return;
      
      const meeting = meetings.get(participantInfo.meetingId);
      if (!meeting || !meeting.canPerformHostAction(socket.id)) {
        socket.emit('action-error', { message: 'Only host can mute all participants' });
        return;
      }

      // Update permissions and mute participants if needed
      meeting.updatePermissions({ muteAllParticipants: muteAll });

      // Notify all participants
      io.to(participantInfo.meetingId).emit('all-participants-muted', {
        muteAll,
        participants: Array.from(meeting.participants.values()),
        permissions: meeting.getPermissions(),
        mutedBy: meeting.participants.get(socket.id)?.name
      });

      console.log(`Host ${socket.id} ${muteAll ? 'muted' : 'unmuted'} all participants in meeting ${participantInfo.meetingId}`);
    });

    
    socket.on('disconnect', () => {
      const participantInfo = participants.get(socket.id);
      
      if (participantInfo) {
        const meeting = meetings.get(participantInfo.meetingId);
        
        if (meeting) {
          const participant = meeting.participants.get(socket.id);
          
          meeting.removeParticipant(socket.id);
          
          if (participantInfo.isHost) {
            socket.to(participantInfo.meetingId).emit('meeting-ended');
            
            meetings.delete(participantInfo.meetingId);
            
            console.log(`Meeting ${participantInfo.meetingId} ended - host disconnected`);
          } else {
            socket.to(participantInfo.meetingId).emit('participant-left', {
              socketId: socket.id,
              participantName: participant?.name,
              participants: Array.from(meeting.participants.values())
            });
            
            console.log(`Participant ${socket.id} left meeting ${participantInfo.meetingId}`);
          }
        }
        
        participants.delete(socket.id);
      }
      
      console.log('User disconnected:', socket.id);
    });
  });

  return { io, setupMeetingRoutes };
};
