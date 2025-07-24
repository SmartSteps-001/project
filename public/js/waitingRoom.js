import { authenticateUser } from './auth.js';

// Waiting room management
const waitingRooms = new Map(); // meetingId -> waiting room data
const waitingParticipants = new Map(); // socketId -> participant data

class WaitingRoomManager {
    constructor(meetingId) {
        this.meetingId = meetingId;
        this.enabled = true;
        this.welcomeMessage = "Welcome to the meeting! Please wait while the host admits you.";
        this.autoAdmit = false;
        this.mutedOnEntry = true;
        this.participants = new Map(); // socketId -> participant data
        this.hostSocketId = null;
    }

    setHost(socketId) {
        this.hostSocketId = socketId;
    }

    addParticipant(socketId, participantData) {
        this.participants.set(socketId, {
            ...participantData,
            joinedAt: new Date(),
            status: 'waiting'
        });
    }

    removeParticipant(socketId) {
        this.participants.delete(socketId);
    }

    getWaitingParticipants() {
        return Array.from(this.participants.values()).filter(p => p.status === 'waiting');
    }

    admitParticipant(socketId) {
        const participant = this.participants.get(socketId);
        if (participant) {
            participant.status = 'admitted';
            return participant;
        }
        return null;
    }

    denyParticipant(socketId, reason = 'Entry denied by host') {
        const participant = this.participants.get(socketId);
        if (participant) {
            participant.status = 'denied';
            participant.denialReason = reason;
            return participant;
        }
        return null;
    }

    updateSettings(settings) {
        if (settings.enabled !== undefined) this.enabled = settings.enabled;
        if (settings.welcomeMessage !== undefined) this.welcomeMessage = settings.welcomeMessage;
        if (settings.autoAdmit !== undefined) this.autoAdmit = settings.autoAdmit;
        if (settings.mutedOnEntry !== undefined) this.mutedOnEntry = settings.mutedOnEntry;
    }

    getSettings() {
        return {
            enabled: this.enabled,
            welcomeMessage: this.welcomeMessage,
            autoAdmit: this.autoAdmit,
            mutedOnEntry: this.mutedOnEntry
        };
    }
}

export const setupWaitingRoom = (app, io) => {
    // Waiting room page route
    app.get('/waiting/:meetingId', (req, res) => {
        res.sendFile(path.join(__dirname, '../public', 'waiting-room.html'));
    });

    // API routes for waiting room management
    app.get('/api/waiting-room/:meetingId/settings', authenticateUser, (req, res) => {
        const { meetingId } = req.params;
        const waitingRoom = waitingRooms.get(meetingId);
        
        if (!waitingRoom) {
            return res.status(404).json({ error: 'Waiting room not found' });
        }

        res.json(waitingRoom.getSettings());
    });

    app.post('/api/waiting-room/:meetingId/settings', authenticateUser, (req, res) => {
        const { meetingId } = req.params;
        let waitingRoom = waitingRooms.get(meetingId);
        
        if (!waitingRoom) {
            waitingRoom = new WaitingRoomManager(meetingId);
            waitingRooms.set(meetingId, waitingRoom);
        }

        waitingRoom.updateSettings(req.body);
        
        // Notify all participants in waiting room about settings change
        io.to(`waiting-${meetingId}`).emit('waiting-room-settings', waitingRoom.getSettings());
        
        res.json({ success: true, settings: waitingRoom.getSettings() });
    });

    app.get('/api/waiting-room/:meetingId/participants', authenticateUser, (req, res) => {
        const { meetingId } = req.params;
        const waitingRoom = waitingRooms.get(meetingId);
        
        if (!waitingRoom) {
            return res.status(404).json({ error: 'Waiting room not found' });
        }

        res.json({
            participants: waitingRoom.getWaitingParticipants()
        });
    });

    app.post('/api/waiting-room/:meetingId/admit', authenticateUser, (req, res) => {
        const { meetingId } = req.params;
        const { participantId } = req.body;
        const waitingRoom = waitingRooms.get(meetingId);
        
        if (!waitingRoom) {
            return res.status(404).json({ error: 'Waiting room not found' });
        }

        const participant = waitingRoom.admitParticipant(participantId);
        if (participant) {
            // Notify the participant they've been admitted
            io.to(participantId).emit('admitted-to-meeting', {
                meetingId,
                mutedOnEntry: waitingRoom.mutedOnEntry
            });
            
            // Notify host about participant admission
            if (waitingRoom.hostSocketId) {
                io.to(waitingRoom.hostSocketId).emit('participant-admitted', {
                    participant: participant
                });
            }
            
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Participant not found' });
        }
    });

    app.post('/api/waiting-room/:meetingId/deny', authenticateUser, (req, res) => {
        const { meetingId } = req.params;
        const { participantId, reason } = req.body;
        const waitingRoom = waitingRooms.get(meetingId);
        
        if (!waitingRoom) {
            return res.status(404).json({ error: 'Waiting room not found' });
        }

        const participant = waitingRoom.denyParticipant(participantId, reason);
        if (participant) {
            // Notify the participant they've been denied
            io.to(participantId).emit('denied-entry', {
                reason: reason || 'Entry denied by host'
            });
            
            // Remove from waiting room
            waitingRoom.removeParticipant(participantId);
            
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Participant not found' });
        }
    });

    // Socket event handlers
    const setupWaitingRoomSocketHandlers = (socket) => {
        socket.on('request-to-join', (data) => {
            const { meetingId, participantName, deviceSettings } = data;
            
            let waitingRoom = waitingRooms.get(meetingId);
            if (!waitingRoom) {
                waitingRoom = new WaitingRoomManager(meetingId);
                waitingRooms.set(meetingId, waitingRoom);
            }

            // Add participant to waiting room
            waitingRoom.addParticipant(socket.id, {
                socketId: socket.id,
                name: participantName,
                deviceSettings: deviceSettings,
                joinedAt: new Date()
            });

            // Join waiting room socket room
            socket.join(`waiting-${meetingId}`);
            
            // Store participant data globally
            waitingParticipants.set(socket.id, {
                meetingId,
                participantName,
                deviceSettings,
                status: 'waiting'
            });

            // Send waiting room settings to participant
            socket.emit('waiting-room-settings', waitingRoom.getSettings());

            // Notify host about new participant in waiting room (subtle notification)
            if (waitingRoom.hostSocketId) {
                io.to(waitingRoom.hostSocketId).emit('waiting-room-notification', {
                    type: 'participant-joined',
                    participant: {
                        socketId: socket.id,
                        name: participantName,
                        joinedAt: new Date()
                    },
                    waitingCount: waitingRoom.getWaitingParticipants().length
                });
            }

            // Auto-admit if enabled
            if (waitingRoom.autoAdmit) {
                setTimeout(() => {
                    const participant = waitingRoom.admitParticipant(socket.id);
                    if (participant) {
                        socket.emit('admitted-to-meeting', {
                            meetingId,
                            mutedOnEntry: waitingRoom.mutedOnEntry
                        });
                    }
                }, 1000);
            }

            console.log(`Participant ${participantName} joined waiting room for meeting ${meetingId}`);
        });

        socket.on('host-joined-meeting', (data) => {
            const { meetingId } = data;
            let waitingRoom = waitingRooms.get(meetingId);
            
            if (!waitingRoom) {
                waitingRoom = new WaitingRoomManager(meetingId);
                waitingRooms.set(meetingId, waitingRoom);
            }
            
            waitingRoom.setHost(socket.id);
            
            // Send current waiting participants to host
            const waitingParticipants = waitingRoom.getWaitingParticipants();
            if (waitingParticipants.length > 0) {
                socket.emit('waiting-room-participants', {
                    participants: waitingParticipants
                });
            }
        });

        socket.on('update-waiting-room-settings', (data) => {
            const { meetingId, settings } = data;
            const waitingRoom = waitingRooms.get(meetingId);
            
            if (waitingRoom && waitingRoom.hostSocketId === socket.id) {
                waitingRoom.updateSettings(settings);
                
                // Notify all participants in waiting room
                io.to(`waiting-${meetingId}`).emit('waiting-room-settings', waitingRoom.getSettings());
                
                socket.emit('waiting-room-settings-updated', { success: true });
            }
        });

        socket.on('admit-participant', (data) => {
            const { meetingId, participantId } = data;
            const waitingRoom = waitingRooms.get(meetingId);
            
            if (waitingRoom && waitingRoom.hostSocketId === socket.id) {
                const participant = waitingRoom.admitParticipant(participantId);
                if (participant) {
                    io.to(participantId).emit('admitted-to-meeting', {
                        meetingId,
                        mutedOnEntry: waitingRoom.mutedOnEntry
                    });
                    
                    socket.emit('participant-admitted', { participantId });
                }
            }
        });

        socket.on('deny-participant', (data) => {
            const { meetingId, participantId, reason } = data;
            const waitingRoom = waitingRooms.get(meetingId);
            
            if (waitingRoom && waitingRoom.hostSocketId === socket.id) {
                const participant = waitingRoom.denyParticipant(participantId, reason);
                if (participant) {
                    io.to(participantId).emit('denied-entry', {
                        reason: reason || 'Entry denied by host'
                    });
                    
                    waitingRoom.removeParticipant(participantId);
                    socket.emit('participant-denied', { participantId });
                }
            }
        });

        socket.on('get-waiting-participants', (data) => {
            const { meetingId } = data;
            const waitingRoom = waitingRooms.get(meetingId);
            
            if (waitingRoom && waitingRoom.hostSocketId === socket.id) {
                socket.emit('waiting-room-participants', {
                    participants: waitingRoom.getWaitingParticipants()
                });
            }
        });

        // Handle disconnect
        const handleWaitingRoomDisconnect = () => {
            const participantData = waitingParticipants.get(socket.id);
            
            if (participantData) {
                const { meetingId } = participantData;
                const waitingRoom = waitingRooms.get(meetingId);
                
                if (waitingRoom) {
                    waitingRoom.removeParticipant(socket.id);
                    
                    // Notify host if participant left waiting room
                    if (waitingRoom.hostSocketId && participantData.status === 'waiting') {
                        io.to(waitingRoom.hostSocketId).emit('waiting-room-notification', {
                            type: 'participant-left',
                            participant: {
                                socketId: socket.id,
                                name: participantData.participantName
                            },
                            waitingCount: waitingRoom.getWaitingParticipants().length
                        });
                    }
                }
                
                waitingParticipants.delete(socket.id);
            }
        };

        return { handleWaitingRoomDisconnect };
    };

    return { setupWaitingRoomSocketHandlers, waitingRooms };
};