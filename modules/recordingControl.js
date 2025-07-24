import { EventEmitter } from 'events';

class RecordingControlManager extends EventEmitter {
  constructor() {
    super();
    this.meetings = new Map(); // meetingId -> { recordingAllowed: boolean, participants: Set }
    this.participantMeetings = new Map(); // socketId -> meetingId
  }

  // Initialize a meeting with default recording settings
  initializeMeeting(meetingId, recordingAllowed = false) {
    if (!this.meetings.has(meetingId)) {
      this.meetings.set(meetingId, {
        recordingAllowed,
        participants: new Set()
      });
    }
    return this.meetings.get(meetingId);
  }

  // Add participant to meeting
  addParticipant(meetingId, socketId) {
    const meeting = this.initializeMeeting(meetingId);
    meeting.participants.add(socketId);
    this.participantMeetings.set(socketId, meetingId);
    
    // Emit current recording permission to the new participant
    this.emit('participantJoined', {
      socketId,
      meetingId,
      recordingAllowed: meeting.recordingAllowed
    });
  }

  // Remove participant from meeting
  removeParticipant(socketId) {
    const meetingId = this.participantMeetings.get(socketId);
    if (meetingId && this.meetings.has(meetingId)) {
      const meeting = this.meetings.get(meetingId);
      meeting.participants.delete(socketId);
      this.participantMeetings.delete(socketId);
      
      // Clean up empty meetings
      if (meeting.participants.size === 0) {
        this.meetings.delete(meetingId);
      }
    }
  }

  // Update recording permission for a meeting
  updateRecordingPermission(meetingId, recordingAllowed, hostSocketId) {
    const meeting = this.meetings.get(meetingId);
    if (!meeting) {
      return { success: false, error: 'Meeting not found' };
    }

    meeting.recordingAllowed = recordingAllowed;
    
    // Notify all participants about the permission change
    this.emit('recordingPermissionChanged', {
      meetingId,
      recordingAllowed,
      participants: Array.from(meeting.participants),
      hostSocketId
    });

    return { success: true, recordingAllowed };
  }

  // Check if recording is allowed for a participant
  isRecordingAllowed(socketId) {
    const meetingId = this.participantMeetings.get(socketId);
    if (!meetingId || !this.meetings.has(meetingId)) {
      return false;
    }
    return this.meetings.get(meetingId).recordingAllowed;
  }

  // Get meeting recording status
  getMeetingRecordingStatus(meetingId) {
    const meeting = this.meetings.get(meetingId);
    return meeting ? meeting.recordingAllowed : false;
  }

  // Get all participants in a meeting
  getMeetingParticipants(meetingId) {
    const meeting = this.meetings.get(meetingId);
    return meeting ? Array.from(meeting.participants) : [];
  }
}

// Setup recording control routes and socket handlers
export function setupRecordingControl(app, io) {
  const recordingManager = new RecordingControlManager();

  // API endpoint to update recording permissions
  app.post('/api/meeting/:meetingId/recording-permission', (req, res) => {
    const { meetingId } = req.params;
    const { recordingAllowed, hostSocketId } = req.body;

    const result = recordingManager.updateRecordingPermission(
      meetingId, 
      recordingAllowed, 
      hostSocketId
    );

    res.json(result);
  });

  // API endpoint to get recording permission status
  app.get('/api/meeting/:meetingId/recording-permission', (req, res) => {
    const { meetingId } = req.params;
    const recordingAllowed = recordingManager.getMeetingRecordingStatus(meetingId);
    
    res.json({ recordingAllowed });
  });

  // Socket event handlers
  const setupSocketHandlers = (socket) => {
    // Handle participant joining meeting
    socket.on('join-meeting-recording', (data) => {
      const { meetingId } = data;
      recordingManager.addParticipant(meetingId, socket.id);
    });

    // Handle host updating recording permissions
    socket.on('update-recording-permission', (data) => {
      const { meetingId, recordingAllowed } = data;
      recordingManager.updateRecordingPermission(meetingId, recordingAllowed, socket.id);
    });

    // Handle participant requesting recording permission check
    socket.on('check-recording-permission', () => {
      const recordingAllowed = recordingManager.isRecordingAllowed(socket.id);
      socket.emit('recording-permission-status', { recordingAllowed });
    });

    // Handle participant disconnect
    const handleDisconnect = () => {
      recordingManager.removeParticipant(socket.id);
    };

    return { handleDisconnect };
  };

  // Listen to recording manager events
  recordingManager.on('participantJoined', (data) => {
    const { socketId, recordingAllowed } = data;
    io.to(socketId).emit('recording-permission-status', { recordingAllowed });
  });

  recordingManager.on('recordingPermissionChanged', (data) => {
    const { participants, recordingAllowed, hostSocketId } = data;
    
    // Notify all participants except the host
    participants.forEach(participantSocketId => {
      if (participantSocketId !== hostSocketId) {
        io.to(participantSocketId).emit('recording-permission-updated', { 
          recordingAllowed 
        });
      }
    });
  });

  return {
    recordingManager,
    setupSocketHandlers
  };
}