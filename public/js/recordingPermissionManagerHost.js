class RecordingPermissionManager {
            constructor() {
                this.dropdown = document.getElementById('recording-permission-dropdown');
                this.permissionRequestModal = document.getElementById('permissionRequestModal');
                this.notificationBadge = document.getElementById('notificationBadge');
                this.dontShowAgainCheckbox = document.getElementById('dontShowAgain');
                this.currentRequest = null;
                this.socket = io();
                this.permissionRequestsBlocked = false;
                this.init();
            }

            init() {
                this.dropdown.addEventListener('change', (e) => {
                    this.handlePermissionChange(e.target.value);
                });
                
                this.setupModalHandlers();
                this.setupSocketListeners();
                
                // Set initial state
                this.handlePermissionChange(this.dropdown.value);
            }

            setupSocketListeners() {
                // Listen for permission requests
                this.socket.on('recording-permission-request', (request) => {
                    this.handlePermissionRequest(request);
                });
            }

            setupModalHandlers() {
                const denyBtn = document.getElementById('denyRequest');
                const approveBtn = document.getElementById('approveRequest');

                denyBtn.addEventListener('click', () => {
                    this.respondToRequest(false);
                });

                approveBtn.addEventListener('click', () => {
                    this.respondToRequest(true);
                });

                // Close modal when clicking outside
                this.permissionRequestModal.addEventListener('click', (e) => {
                    if (e.target === this.permissionRequestModal) {
                        this.hideRequestModal();
                    }
                });
            }

            handlePermissionRequest(request) {
                // Check if permission requests are blocked
                if (this.permissionRequestsBlocked) {
                    return;
                }

                this.currentRequest = request;
                
                // Update modal content
                document.getElementById('requestParticipantName').textContent = request.participantName;
                document.getElementById('requestParticipantId').textContent = request.participantId;
                
                // Show notification badge
                this.showNotificationBadge();
                
                // Show modal
                this.showRequestModal();
            }

            showNotificationBadge() {
                this.notificationBadge.style.display = 'block';
                setTimeout(() => {
                    this.notificationBadge.style.display = 'none';
                }, 5000);
            }

            showRequestModal() {
                this.permissionRequestModal.classList.add('show');
            }

            hideRequestModal() {
                this.permissionRequestModal.classList.remove('show');
                
                // Check if user wants to block future requests
                if (this.dontShowAgainCheckbox.checked) {
                    this.permissionRequestsBlocked = true;
                }
                
                // Reset checkbox for next time
                this.dontShowAgainCheckbox.checked = false;
                
                this.currentRequest = null;
            }

            async respondToRequest(approved) {
                if (!this.currentRequest) return;

                try {
                    const response = await fetch('/api/respond-recording-request', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            requestId: this.currentRequest.id,
                            approved: approved,
                            participantId: this.currentRequest.participantId
                        })
                    });

                    if (response.ok) {
                        console.log(`Request ${approved ? 'approved' : 'denied'}`);
                        
                        // If approved, automatically enable recording
                        if (approved) {
                            this.dropdown.value = 'Record to Computer';
                            await this.handlePermissionChange('Record to Computer');
                        }
                    } else {
                        throw new Error('Failed to respond to request');
                    }
                } catch (error) {
                    console.error('Error responding to request:', error);
                }

                this.hideRequestModal();
            }

            async handlePermissionChange(value) {
                try {
                    const response = await fetch('/api/recording-permission', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            permission: value,
                            timestamp: Date.now()
                        })
                    });

                    if (!response.ok) {
                        throw new Error('Failed to update permission');
                    }

                    const result = await response.json();
                    console.log('Permission updated:', result);
                    
                } catch (error) {
                    console.error('Error updating recording permission:', error);
                }
            }
        }

        // Initialize when DOM is loaded
        document.addEventListener('DOMContentLoaded', () => {
            new RecordingPermissionManager();
        });