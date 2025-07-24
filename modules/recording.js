// modules/recordingPermission.js
import express from 'express';

// Additional security layer
const securityTokens = new Map();
const pendingRequests = new Map();

class RecordingPermissionManager {
    constructor() {
        this.permission = 'Don\'t Record';
        this.timestamp = Date.now();
        this.locked = false;
    }

    setPermission(newPermission, sessionId = null) {
        if (this.locked && newPermission !== 'Don\'t Record') {
            throw new Error('Recording permission is locked');
        }
        
        this.permission = newPermission;
        this.timestamp = Date.now();
        
        // Generate security token
        if (newPermission === 'Record to Computer') {
            const token = this.generateSecurityToken();
            securityTokens.set(sessionId || 'default', token);
        } else {
            securityTokens.clear();
        }
        
        return {
            permission: this.permission,
            timestamp: this.timestamp,
            token: securityTokens.get(sessionId || 'default')
        };
    }

    getPermission() {
        return {
            permission: this.permission,
            timestamp: this.timestamp,
            isLocked: this.locked
        };
    }

    generateSecurityToken() {
        return Math.random().toString(36).substring(2, 15) + 
               Math.random().toString(36).substring(2, 15);
    }

    lockPermission() {
        this.locked = true;
    }

    unlockPermission() {
        this.locked = false;
    }
}

const permissionManager = new RecordingPermissionManager();

// Setup recording permission routes and socket handlers
export function setuprecording(app, io) {
    // API endpoint to set recording permission
    app.post('/api/recording-permission', (req, res) => {
        try {
            const { permission, sessionId } = req.body;
            
            if (!permission || !['Don\'t Record', 'Record to Computer'].includes(permission)) {
                return res.status(400).json({ 
                    error: 'Invalid permission value',
                    validOptions: ['Don\'t Record', 'Record to Computer']
                });
            }

            const result = permissionManager.setPermission(permission, sessionId);
            
            // Log the permission change
            console.log(`Recording permission changed to: ${permission} at ${new Date().toISOString()}`);
            
            // Broadcast permission change to all connected clients
            io.emit('recording-permission-changed', {
                permission: result.permission,
                timestamp: result.timestamp
            });
            
            // If setting to "Don't Record", perform additional security measures
            if (permission === 'Don\'t Record') {
                // Clear any existing tokens
                securityTokens.clear();
                
                // Lock the permission temporarily
                permissionManager.lockPermission();
                
                // Unlock after 1 second to prevent rapid toggles
                setTimeout(() => {
                    permissionManager.unlockPermission();
                }, 1000);
                
                // Notify clients to stop any ongoing recordings
                io.emit('recording-stop-required');
            }
            
            res.json({
                success: true,
                permission: result.permission,
                timestamp: result.timestamp,
                message: `Recording permission set to: ${permission}`
            });
            
        } catch (error) {
            console.error('Error setting recording permission:', error);
            res.status(500).json({ 
                error: 'Failed to set recording permission',
                message: error.message
            });
        }
    });

    // API endpoint to get current recording permission
    app.get('/api/recording-permission', (req, res) => {
        try {
            const result = permissionManager.getPermission();
            
            res.json({
                permission: result.permission,
                timestamp: result.timestamp,
                isLocked: result.isLocked,
                serverTime: Date.now()
            });
            
        } catch (error) {
            console.error('Error getting recording permission:', error);
            res.status(500).json({ 
                error: 'Failed to get recording permission',
                message: error.message
            });
        }
    });

    // API endpoint to request recording permission
    app.post('/api/request-recording-permission', (req, res) => {
        try {
            const { participantName, participantId } = req.body;
            
            if (!participantName || !participantId) {
                return res.status(400).json({
                    error: 'Participant name and ID are required'
                });
            }

            const requestId = Date.now().toString();
            const request = {
                id: requestId,
                participantName,
                participantId,
                timestamp: Date.now()
            };

            pendingRequests.set(requestId, request);

            // Send request to host
            io.emit('recording-permission-request', request);

            res.json({
                success: true,
                requestId,
                message: 'Permission request sent to host'
            });

        } catch (error) {
            console.error('Error requesting recording permission:', error);
            res.status(500).json({
                error: 'Failed to send permission request',
                message: error.message
            });
        }
    });

    // API endpoint to respond to recording permission request
    app.post('/api/respond-recording-request', (req, res) => {
        try {
            const { requestId, approved, participantId } = req.body;
            
            if (!requestId || approved === undefined || !participantId) {
                return res.status(400).json({
                    error: 'Request ID, approval status, and participant ID are required'
                });
            }

            const request = pendingRequests.get(requestId);
            if (!request) {
                return res.status(404).json({
                    error: 'Request not found or expired'
                });
            }

            // Remove the request from pending
            pendingRequests.delete(requestId);

            // Send response to the specific participant
            io.emit('recording-permission-response', {
                requestId,
                approved,
                participantId,
                timestamp: Date.now()
            });

            res.json({
                success: true,
                message: `Request ${approved ? 'approved' : 'denied'}`
            });

        } catch (error) {
            console.error('Error responding to recording request:', error);
            res.status(500).json({
                error: 'Failed to respond to request',
                message: error.message
            });
        }
    });

    // API endpoint to validate recording token (additional security)
    app.post('/api/validate-recording', (req, res) => {
        try {
            const { token, sessionId } = req.body;
            const storedToken = securityTokens.get(sessionId || 'default');
            
            if (!token || !storedToken || token !== storedToken) {
                return res.status(403).json({
                    error: 'Invalid or expired recording token',
                    canRecord: false
                });
            }
            
            const permission = permissionManager.getPermission();
            
            res.json({
                canRecord: permission.permission === 'Record to Computer',
                permission: permission.permission,
                timestamp: permission.timestamp
            });
            
        } catch (error) {
            console.error('Error validating recording token:', error);
            res.status(500).json({ 
                error: 'Failed to validate recording token',
                canRecord: false
            });
        }
    });

    // Protected recording endpoints with permission check
    app.post('/api/recording/start', (req, res) => {
        const permission = permissionManager.getPermission();
        
        if (permission.permission === 'Don\'t Record') {
            return res.status(403).json({
                error: 'Recording is disabled by host settings',
                permission: permission.permission
            });
        }
        
        // Broadcast recording start to all clients
        io.emit('recording-started', {
            timestamp: Date.now(),
            permission: permission.permission
        });
        
        res.json({ 
            success: true, 
            message: 'Recording started',
            timestamp: Date.now()
        });
    });

    app.post('/api/recording/stop', (req, res) => {
        const permission = permissionManager.getPermission();
        
        if (permission.permission === 'Don\'t Record') {
            return res.status(403).json({
                error: 'Recording is disabled by host settings',
                permission: permission.permission
            });
        }
        
        // Broadcast recording stop to all clients
        io.emit('recording-stopped', {
            timestamp: Date.now(),
            permission: permission.permission
        });
        
        res.json({ 
            success: true, 
            message: 'Recording stopped',
            timestamp: Date.now()
        });
    });

    // Setup socket handlers for recording permission
    function setupSocketHandlers(socket) {
        // Handle recording permission requests from clients
        socket.on('request-recording-permission', (callback) => {
            const permission = permissionManager.getPermission();
            if (callback) {
                callback(permission);
            }
        });

        // Handle recording permission changes from host
        socket.on('change-recording-permission', (data) => {
            try {
                const { permission, sessionId } = data;
                const result = permissionManager.setPermission(permission, sessionId);
                
                // Broadcast to all clients
                io.emit('recording-permission-changed', {
                    permission: result.permission,
                    timestamp: result.timestamp
                });
                
                console.log(`Recording permission changed via socket to: ${permission}`);
            } catch (error) {
                console.error('Error changing recording permission via socket:', error);
                socket.emit('recording-permission-error', {
                    error: error.message
                });
            }
        });

        // Handle recording control events
        socket.on('start-recording', (data) => {
            const permission = permissionManager.getPermission();
            
            if (permission.permission === 'Don\'t Record') {
                socket.emit('recording-error', {
                    error: 'Recording is disabled by host settings'
                });
                return;
            }
            
            // Broadcast recording start
            io.emit('recording-started', {
                timestamp: Date.now(),
                initiator: socket.id,
                ...data
            });
        });

        socket.on('stop-recording', (data) => {
            // Broadcast recording stop
            io.emit('recording-stopped', {
                timestamp: Date.now(),
                initiator: socket.id,
                ...data
            });
        });

        // Handle permission request via socket
        socket.on('request-recording-permission-socket', (data) => {
            const { participantName, participantId } = data;
            
            const requestId = Date.now().toString();
            const request = {
                id: requestId,
                participantName,
                participantId,
                timestamp: Date.now(),
                socketId: socket.id
            };

            pendingRequests.set(requestId, request);

            // Send request to host
            io.emit('recording-permission-request', request);
            
            // Send confirmation to requester
            socket.emit('recording-permission-request-sent', {
                requestId,
                message: 'Permission request sent to host'
            });
        });

        // Handle permission response via socket
        socket.on('respond-recording-request-socket', (data) => {
            const { requestId, approved, participantId } = data;
            
            const request = pendingRequests.get(requestId);
            if (!request) {
                socket.emit('recording-permission-error', {
                    error: 'Request not found or expired'
                });
                return;
            }

            // Remove the request from pending
            pendingRequests.delete(requestId);

            // Send response to the specific participant
            io.emit('recording-permission-response', {
                requestId,
                approved,
                participantId,
                timestamp: Date.now()
            });
        });

        // Handle disconnect
        function handleDisconnect() {
            // Clean up any session-specific tokens
            securityTokens.delete(socket.id);
            
            // Clean up any pending requests from this socket
            for (const [requestId, request] of pendingRequests.entries()) {
                if (request.socketId === socket.id) {
                    pendingRequests.delete(requestId);
                }
            }
        }

        return { handleDisconnect };
    }

    return {
        permissionManager,
        setupSocketHandlers,
        getPermission: () => permissionManager.getPermission(),
        setPermission: (permission, sessionId) => permissionManager.setPermission(permission, sessionId)
    };
}