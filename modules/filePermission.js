// modules/filePermission.js
import express from 'express';

// In-memory storage for file sharing permissions
let filePermissionState = {
    enabled: true // Default to enabled
};

/**
 * Setup file permission management functionality
 * @param {express.Application} app - Express application instance
 * @param {import('socket.io').Server} io - Socket.IO server instance
 * @returns {Object} - API object with permission management methods
 */
export function setupFilePermission(app, io) {
    // API route to get current file sharing permission status
    app.get('/api/file-sharing-status', (req, res) => {
        try {
            res.json({ 
                success: true,
                enabled: filePermissionState.enabled 
            });
        } catch (error) {
            console.error('Error getting file sharing status:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Failed to get file sharing status' 
            });
        }
    });

    // API route to toggle file sharing permission
    app.post('/api/file-sharing-toggle', (req, res) => {
        try {
            const { enabled } = req.body;
            
            // Validate input
            if (typeof enabled !== 'boolean') {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Invalid input: enabled must be a boolean' 
                });
            }
            
            filePermissionState.enabled = enabled;
            console.log(`File sharing ${enabled ? 'enabled' : 'disabled'}`);
            
            // Broadcast permission change to all connected clients
            io.emit('file-sharing-permission-changed', { 
                enabled: filePermissionState.enabled 
            });
            
            res.json({ 
                success: true, 
                enabled: filePermissionState.enabled 
            });
        } catch (error) {
            console.error('Error toggling file sharing:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Failed to toggle file sharing' 
            });
        }
    });

    // API route to reset file sharing to enabled (for page reload or initialization)
    app.post('/api/reset-file-sharing', (req, res) => {
        try {
            filePermissionState.enabled = true;
            console.log('File sharing reset to enabled');
            
            // Broadcast permission reset to all connected clients
            io.emit('file-sharing-permission-changed', { 
                enabled: filePermissionState.enabled 
            });
            
            res.json({ 
                success: true, 
                enabled: filePermissionState.enabled 
            });
        } catch (error) {
            console.error('Error resetting file sharing:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Failed to reset file sharing' 
            });
        }
    });

    // Socket.IO event handlers for real-time permission management
    const setupSocketHandlers = (socket) => {
        // Handle file sharing permission toggle from client
        socket.on('toggle-file-sharing-permission', (data) => {
            try {
                const { enabled } = data;
                
                if (typeof enabled !== 'boolean') {
                    socket.emit('file-sharing-permission-error', { 
                        error: 'Invalid input: enabled must be a boolean' 
                    });
                    return;
                }
                
                filePermissionState.enabled = enabled;
                console.log(`File sharing ${enabled ? 'enabled' : 'disabled'} via socket from ${socket.id}`);
                
                // Broadcast to all clients including sender
                io.emit('file-sharing-permission-changed', { 
                    enabled: filePermissionState.enabled 
                });
                
            } catch (error) {
                console.error('Error handling file sharing permission toggle:', error);
                socket.emit('file-sharing-permission-error', { 
                    error: 'Failed to toggle file sharing permission' 
                });
            }
        });

        // Handle request for current permission status
        socket.on('get-file-sharing-permission', () => {
            try {
                socket.emit('file-sharing-permission-status', { 
                    enabled: filePermissionState.enabled 
                });
            } catch (error) {
                console.error('Error getting file sharing permission status:', error);
                socket.emit('file-sharing-permission-error', { 
                    error: 'Failed to get file sharing permission status' 
                });
            }
        });

        // Send current permission status when client connects
        socket.emit('file-sharing-permission-status', { 
            enabled: filePermissionState.enabled 
        });

        // Cleanup function for disconnect handling
        const handleDisconnect = () => {
            // No specific cleanup needed for file permissions
            // as state is maintained globally
        };

        return { handleDisconnect };
    };

    // Permission manager object with utility methods
    const permissionManager = {
        // Get current permission state
        getPermission: () => ({
            enabled: filePermissionState.enabled
        }),

        // Set permission state programmatically
        setPermission: (enabled) => {
            if (typeof enabled !== 'boolean') {
                throw new Error('Permission must be a boolean value');
            }
            filePermissionState.enabled = enabled;
            console.log(`File sharing permission set to ${enabled ? 'enabled' : 'disabled'}`);
            
            // Broadcast change to all connected clients
            io.emit('file-sharing-permission-changed', { 
                enabled: filePermissionState.enabled 
            });
            
            return filePermissionState.enabled;
        },

        // Reset permission to default (enabled)
        resetPermission: () => {
            filePermissionState.enabled = true;
            console.log('File sharing permission reset to enabled');
            
            // Broadcast reset to all connected clients
            io.emit('file-sharing-permission-changed', { 
                enabled: filePermissionState.enabled 
            });
            
            return filePermissionState.enabled;
        },

        // Check if file sharing is currently enabled
        isEnabled: () => filePermissionState.enabled,

        // Toggle permission state
        togglePermission: () => {
            filePermissionState.enabled = !filePermissionState.enabled;
            console.log(`File sharing permission toggled to ${filePermissionState.enabled ? 'enabled' : 'disabled'}`);
            
            // Broadcast change to all connected clients
            io.emit('file-sharing-permission-changed', { 
                enabled: filePermissionState.enabled 
            });
            
            return filePermissionState.enabled;
        }
    };

    return {
        permissionManager,
        setupSocketHandlers
    };
}