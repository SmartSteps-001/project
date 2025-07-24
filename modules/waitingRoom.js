// Waiting Room Module for Video Call App
import { Server as SocketIO } from 'socket.io';

export const setupWaitingRoom = (io, meetings, participants) => {
  // Store waiting room participants
  const waitingRooms = new Map(); // meetingId -> Map of waiting participants

  // Enhanced Meeting class with waiting room support
  const enhanceMeetingWithWaitingRoom = (Meeting) => {
    return class EnhancedMeeting extends Meeting {
      constructor(id, hostId, hostName) {
        super(id, hostId, hostName);
        this.waitingRoom = new Map(); // socketId -> participant data
        this.waitingRoomEnabled = true;
        this.welcomeMessage = "Welcome! Please wait while the host admits you to the meeting.";
        this.autoAdmit = false;
        this.muteOnEntry = false;
        this.waitingRoomSettings = {
          enabled: true,
          autoAdmit: false,
          muteOnEntry: false,
          welcomeMessage: "Welcome! Please wait while the host admits you to the meeting."
        };
      }

      addToWaitingRoom(socketId, participantData) {
        this.waitingRoom.set(socketId, {
          ...participantData,
          joinedAt: new Date(),
          status: 'waiting'
        });
        
        // Notify host about new participant in waiting room
        io.to(this.hostId).emit('waiting-room-participant-joined', {
          socketId,
          name: participantData.name,
          joinedAt: new Date(),
          waitingCount: this.waitingRoom.size,
          participant: participantData
        });

        // Send notification sound/visual cue to host (non-intrusive)
        io.to(this.hostId).emit('waiting-room-notification', {
          type: 'participant-joined',
          participantName: participantData.name,
          count: this.waitingRoom.size
        });
      }

      removeFromWaitingRoom(socketId) {
        const participant = this.waitingRoom.get(socketId);
        this.waitingRoom.delete(socketId);
        
        // Notify host about participant leaving waiting room
        if (participant) {
          io.to(this.hostId).emit('waiting-room-participant-left', {
            socketId,
            name: participant.name,
            waitingCount: this.waitingRoom.size
          });
        }
        
        return participant;
      }

      admitParticipant(socketId) {
        const participant = this.removeFromWaitingRoom(socketId);
        if (participant) {
          // Add to main meeting
          this.addParticipant(socketId, participant.name, false);
          
          // Apply entry settings
          if (this.waitingRoomSettings.muteOnEntry) {
            const addedParticipant = this.participants.get(socketId);
            if (addedParticipant) {
              addedParticipant.isMuted = true;
            }
          }
          
          return participant;
        }
        return null;
      }

      denyParticipant(socketId, reason = 'Access denied by host') {
        const participant = this.removeFromWaitingRoom(socketId);
        if (participant) {
          io.to(socketId).emit('waiting-room-denied', { reason });
          return participant;
        }
        return null;
      }

      getWaitingParticipants() {
        return Array.from(this.waitingRoom.values());
      }

      updateWaitingRoomSettings(settings) {
        this.waitingRoomSettings = { ...this.waitingRoomSettings, ...settings };
        
        // If waiting room is disabled and there are waiting participants, admit them all
        if (!settings.enabled && this.waitingRoom.size > 0) {
          const waitingParticipants = Array.from(this.waitingRoom.keys());
          waitingParticipants.forEach(socketId => {
            this.admitParticipant(socketId);
            io.to(socketId).emit('waiting-room-admitted');
          });
        }
      }
    };
  };

  // Socket event handlers for waiting room
  io.on('connection', (socket) => {
    
    // Check waiting room status
    socket.on('check-waiting-room-status', (data) => {
      const { meetingId } = data;
      const meeting = meetings.get(meetingId);
      
      if (meeting && meeting.waitingRoomSettings) {
        socket.emit('waiting-room-status', {
          enabled: meeting.waitingRoomSettings.enabled,
          welcomeMessage: meeting.waitingRoomSettings.welcomeMessage
        });
      } else {
        // Meeting doesn't exist or waiting room not configured, allow direct join
        socket.emit('direct-join-allowed');
      }
    });

    // Request to join meeting (from waiting room)
    socket.on('request-join-meeting', (data) => {
      const { meetingId, participantName, deviceSettings, selectedDevices } = data;
      const meeting = meetings.get(meetingId);
      
      if (!meeting) {
        socket.emit('meeting-error', { message: 'Meeting not found' });
        return;
      }

      const participantData = {
        socketId: socket.id,
        name: participantName,
        deviceSettings,
        selectedDevices,
        isHost: false,
        isCoHost: false,
        isMuted: deviceSettings ? !deviceSettings.micEnabled : false,
        isCameraOff: deviceSettings ? !deviceSettings.cameraEnabled : false,
        isSpotlighted: false,
        isScreenSharing: false,
        handRaised: false
      };

      // Check if waiting room is enabled
      if (meeting.waitingRoomSettings && meeting.waitingRoomSettings.enabled) {
        // Add to waiting room
        meeting.addToWaitingRoom(socket.id, participantData);
        
        // Send waiting room status to participant
        socket.emit('waiting-room-status', {
          enabled: true,
          welcomeMessage: meeting.waitingRoomSettings.welcomeMessage,
          inWaitingRoom: true
        });
      } else {
        // Direct join allowed
        meeting.addParticipant(socket.id, participantName, false);
        participants.set(socket.id, { meetingId, isHost: false });
        
        socket.join(meetingId);
        socket.emit('direct-join-allowed');
      }
    });

    // Host actions for waiting room management
    socket.on('get-waiting-room-participants', (data) => {
      const { meetingId } = data;
      const meeting = meetings.get(meetingId);
      
      if (meeting && meeting.canPerformHostAction && meeting.canPerformHostAction(socket.id)) {
        const waitingParticipants = meeting.getWaitingParticipants();
        socket.emit('waiting-room-participants-list', {
          participants: waitingParticipants,
          count: waitingParticipants.length
        });
      }
    });

    socket.on('admit-participant', (data) => {
      const { meetingId, participantSocketId } = data;
      const meeting = meetings.get(meetingId);
      
      if (meeting && meeting.canPerformHostAction && meeting.canPerformHostAction(socket.id)) {
        const participant = meeting.admitParticipant(participantSocketId);
        
        if (participant) {
          // Add to participants map
          participants.set(participantSocketId, { meetingId, isHost: false });
          
          // Join the meeting room
          const participantSocket = io.sockets.sockets.get(participantSocketId);
          if (participantSocket) {
            participantSocket.join(meetingId);
          }
          
          // Notify participant they've been admitted
          io.to(participantSocketId).emit('waiting-room-admitted');
          
          // Notify all meeting participants about new participant
          socket.to(meetingId).emit('participant-joined', {
            participant: meeting.participants.get(participantSocketId),
            participants: Array.from(meeting.participants.values())
          });
          
          // Update waiting room list for host
          socket.emit('waiting-room-participants-list', {
            participants: meeting.getWaitingParticipants(),
            count: meeting.waitingRoom.size
          });
        }
      }
    });

    socket.on('deny-participant', (data) => {
      const { meetingId, participantSocketId, reason } = data;
      const meeting = meetings.get(meetingId);
      
      if (meeting && meeting.canPerformHostAction && meeting.canPerformHostAction(socket.id)) {
        const participant = meeting.denyParticipant(participantSocketId, reason);
        
        if (participant) {
          // Update waiting room list for host
          socket.emit('waiting-room-participants-list', {
            participants: meeting.getWaitingParticipants(),
            count: meeting.waitingRoom.size
          });
        }
      }
    });

    socket.on('admit-all-participants', (data) => {
      const { meetingId } = data;
      const meeting = meetings.get(meetingId);
      
      if (meeting && meeting.canPerformHostAction && meeting.canPerformHostAction(socket.id)) {
        const waitingParticipants = Array.from(meeting.waitingRoom.keys());
        
        waitingParticipants.forEach(participantSocketId => {
          const participant = meeting.admitParticipant(participantSocketId);
          
          if (participant) {
            // Add to participants map
            participants.set(participantSocketId, { meetingId, isHost: false });
            
            // Join the meeting room
            const participantSocket = io.sockets.sockets.get(participantSocketId);
            if (participantSocket) {
              participantSocket.join(meetingId);
            }
            
            // Notify participant they've been admitted
            io.to(participantSocketId).emit('waiting-room-admitted');
          }
        });
        
        // Notify all meeting participants about new participants
        socket.to(meetingId).emit('participants-batch-joined', {
          participants: Array.from(meeting.participants.values())
        });
        
        // Update waiting room list for host
        socket.emit('waiting-room-participants-list', {
          participants: meeting.getWaitingParticipants(),
          count: meeting.waitingRoom.size
        });
      }
    });

    socket.on('update-waiting-room-settings', (data) => {
      const { meetingId, settings } = data;
      const meeting = meetings.get(meetingId);
      
      if (meeting && meeting.canPerformHostAction && meeting.canPerformHostAction(socket.id)) {
        meeting.updateWaitingRoomSettings(settings);
        
        // Notify host about settings update
        socket.emit('waiting-room-settings-updated', {
          settings: meeting.waitingRoomSettings
        });
      }
    });

    socket.on('set-waiting-room-message', (data) => {
      const { meetingId, message } = data;
      const meeting = meetings.get(meetingId);
      
      if (meeting && meeting.canPerformHostAction && meeting.canPerformHostAction(socket.id)) {
        meeting.waitingRoomSettings.welcomeMessage = message;
        
        // Update message for all waiting participants
        meeting.waitingRoom.forEach((participant, socketId) => {
          io.to(socketId).emit('waiting-room-message-updated', {
            message: message
          });
        });
      }
    });

    // Handle participant disconnect from waiting room
    socket.on('disconnect', () => {
      // Check if participant was in any waiting room
      for (const [meetingId, meeting] of meetings) {
        if (meeting.waitingRoom && meeting.waitingRoom.has(socket.id)) {
          meeting.removeFromWaitingRoom(socket.id);
          break;
        }
      }
    });
  });

  return {
    enhanceMeetingWithWaitingRoom
  };
};

// Export waiting room routes
export const setupWaitingRoomRoutes = (app) => {
  // Waiting room page route
  app.get('/waiting/:meetingId', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'waitingRoom.html'));
  });
};