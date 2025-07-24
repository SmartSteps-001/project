 class RecordingButtonManager {
            constructor() {
                this.captureBtn = document.getElementById('startCaptureBtn');
                this.tooltip = document.getElementById('recordingTooltip');
                this.permissionModal = document.getElementById('permissionModal');
                this.notificationSlide = document.getElementById('notificationSlide');
                this.isRecordingAllowed = false;
                this.hasRequestedPermission = false;
                this.participantId = this.generateParticipantId();
                this.participantName = this.generateParticipantName();
                this.socket = io();
                this.init();
            }

            generateParticipantId() {
                return 'participant_' + Math.random().toString(36).substr(2, 9);
            }

            generateParticipantName() {
                return 'Participant ' + Math.floor(Math.random() * 1000);
            }

            init() {
                this.setupOriginalHandler();
                this.setupTooltipHandlers();
                this.setupModalHandlers();
                this.setupNotificationHandlers();
                this.setupSocketListeners();
                this.startPermissionPolling();
                this.checkInitialPermission();
            }

            setupSocketListeners() {
                // Listen for permission responses
                this.socket.on('recording-permission-response', (data) => {
                    if (data.participantId === this.participantId) {
                        if (data.approved) {
                            this.showNotification('success', 'Permission Granted', 'The host has approved your recording request. You can now record the meeting.');
                            // The permission will be updated via the normal polling mechanism
                        } else {
                            this.showNotification('error', 'Permission Denied', 'The host has denied your recording request.');
                        }
                    }
                });

                // Listen for permission changes
                this.socket.on('recording-permission-changed', (data) => {
                    this.updateButtonState(data.permission);
                });
            }

            setupModalHandlers() {
                const cancelBtn = document.getElementById('cancelRequest');
                const sendBtn = document.getElementById('sendRequest');

                cancelBtn.addEventListener('click', () => {
                    this.hidePermissionModal();
                });

                sendBtn.addEventListener('click', () => {
                    this.sendPermissionRequest();
                });

                // Close modal when clicking outside
                this.permissionModal.addEventListener('click', (e) => {
                    if (e.target === this.permissionModal) {
                        this.hidePermissionModal();
                    }
                });
            }

            setupNotificationHandlers() {
                const closeBtn = document.getElementById('notificationClose');
                closeBtn.addEventListener('click', () => {
                    this.hideNotification();
                });

                // Auto-hide notification after 5 seconds
                this.notificationTimeout = null;
            }

            showPermissionModal() {
                this.permissionModal.classList.add('show');
            }

            hidePermissionModal() {
                this.permissionModal.classList.remove('show');
            }

            showNotification(type, title, message) {
                const slide = this.notificationSlide;
                const icon = document.getElementById('notificationIcon');
                const titleEl = document.getElementById('notificationTitle');
                const bodyEl = document.getElementById('notificationBody');

                // Clear existing timeout
                if (this.notificationTimeout) {
                    clearTimeout(this.notificationTimeout);
                }

                // Set content
                titleEl.textContent = title;
                bodyEl.textContent = message;

                // Set type-specific styling and icon
                slide.className = 'notification-slide';
                if (type === 'success') {
                    slide.classList.add('success');
                    icon.innerHTML = '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22,4 12,14.01 9,11.01"></polyline>';
                } else if (type === 'error') {
                    slide.classList.add('error');
                    icon.innerHTML = '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>';
                } else {
                    icon.innerHTML = '<circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path>';
                }

                // Show notification
                slide.classList.add('show');

                // Auto-hide after 5 seconds
                this.notificationTimeout = setTimeout(() => {
                    this.hideNotification();
                }, 5000);
            }

            hideNotification() {
                this.notificationSlide.classList.remove('show');
                if (this.notificationTimeout) {
                    clearTimeout(this.notificationTimeout);
                    this.notificationTimeout = null;
                }
            }

            async sendPermissionRequest() {
                try {
                    const response = await fetch('/api/request-recording-permission', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            participantName: this.participantName,
                            participantId: this.participantId
                        })
                    });

                    if (response.ok) {
                        this.hasRequestedPermission = true;
                        this.hidePermissionModal();
                        this.showNotification('info', 'Request Sent', 'Your recording permission request has been sent to the host. Please wait for their response.');
                    } else {
                        throw new Error('Failed to send request');
                    }
                } catch (error) {
                    console.error('Error sending permission request:', error);
                    this.showNotification('error', 'Request Failed', 'Failed to send permission request. Please try again.');
                }
            }

            setupTooltipHandlers() {
                this.mouseMoveHandler = (e) => {
                    if (!this.isRecordingAllowed) {
                        this.updateTooltipPosition(e);
                    }
                };

                this.mouseEnterHandler = (e) => {
                    if (!this.isRecordingAllowed) {
                        this.showTooltip();
                        this.updateTooltipPosition(e);
                    }
                };

                this.mouseLeaveHandler = (e) => {
                    if (!this.isRecordingAllowed) {
                        this.hideTooltip();
                    }
                };

                this.captureBtn.addEventListener('mouseenter', this.mouseEnterHandler);
                this.captureBtn.addEventListener('mouseleave', this.mouseLeaveHandler);
                this.captureBtn.addEventListener('mousemove', this.mouseMoveHandler);
            }

            updateTooltipPosition(e) {
                const offsetX = 10;
                const offsetY = 10;
                
                this.tooltip.style.left = (e.clientX + offsetX) + 'px';
                this.tooltip.style.top = (e.clientY + offsetY) + 'px';
            }

            showTooltip() {
                this.tooltip.classList.add('show');
            }

            hideTooltip() {
                this.tooltip.classList.remove('show');
            }

            setupOriginalHandler() {
                this.originalHandler = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (!this.isRecordingAllowed) {
                        // Show permission request modal only if not requested before AND recording is actually disabled
                        if (!this.hasRequestedPermission && this.getCurrentPermissionState() === 'Don\'t Record') {
                            this.showPermissionModal();
                        } else if (this.getCurrentPermissionState() === 'Record to Computer') {
                            // If recording is enabled but button state hasn't updated yet, start recording
                            this.startRecording();
                        }
                        return false;
                    }
                    
                    this.startRecording();
                };
                
                this.captureBtn.addEventListener('click', this.originalHandler);
            }

            getCurrentPermissionState() {
                // This will be updated by the polling mechanism
                return this.lastKnownPermission || 'Don\'t Record';
            }
            async checkInitialPermission() {
                try {
                    const response = await fetch('/api/recording-permission');
                    if (response.ok) {
                        const data = await response.json();
                        this.lastKnownPermission = data.permission;
                        this.updateButtonState(data.permission);
                    }
                } catch (error) {
                    console.error('Error checking initial permission:', error);
                    this.lastKnownPermission = 'Don\'t Record';
                    this.updateButtonState('Don\'t Record');
                }
            }

            startPermissionPolling() {
                this.pollInterval = setInterval(async () => {
                    try {
                        const response = await fetch('/api/recording-permission');
                        if (response.ok) {
                            const data = await response.json();
                            this.lastKnownPermission = data.permission;
                            this.updateButtonState(data.permission);
                        }
                    } catch (error) {
                        console.error('Error polling permission:', error);
                    }
                }, 1000);
            }

            updateButtonState(permission) {
                const isAllowed = permission === 'Record to Computer';
                this.isRecordingAllowed = isAllowed;
                this.lastKnownPermission = permission;
                
                if (isAllowed) {
                    this.enableButton();
                } else {
                    this.disableButton();
                }
            }

            disableButton() {
                this.captureBtn.classList.add('disabled');
                this.captureBtn.style.pointerEvents = 'auto';
                this.captureBtn.title = '';
                
                this.captureBtn.removeEventListener('click', this.originalHandler);
                
                this.disabledHandler = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Show permission request modal only if not requested before AND recording is actually disabled
                    if (!this.hasRequestedPermission && this.getCurrentPermissionState() === 'Don\'t Record') {
                        this.showPermissionModal();
                    } else if (this.getCurrentPermissionState() === 'Record to Computer') {
                        // If recording is enabled but button state hasn't updated yet, start recording
                        this.startRecording();
                    }
                    return false;
                };
                
                this.captureBtn.addEventListener('click', this.disabledHandler);
                this.blockBeginCapture();
            }

            enableButton() {
                this.captureBtn.classList.remove('disabled');
                this.captureBtn.style.pointerEvents = 'auto';
                this.captureBtn.title = 'Click to start recording';
                
                if (this.disabledHandler) {
                    this.captureBtn.removeEventListener('click', this.disabledHandler);
                    this.disabledHandler = null;
                }
                
                this.captureBtn.addEventListener = Element.prototype.addEventListener;
                this.captureBtn.click = Element.prototype.click;
                this.captureBtn.addEventListener('click', this.originalHandler);
                this.restoreBeginCapture();
            }

            startRecording() {
                this.showNotification('success', 'Recording Started', 'Meeting recording has started successfully.');
            }
            
            blockBeginCapture() {
                if (typeof window.beginCapture === 'function') {
                    this.originalBeginCapture = window.beginCapture;
                }
                
                window.beginCapture = function() {
                    console.log('beginCapture is disabled - Host has disabled meeting recording');
                    return false;
                };
                
                window.beginCapture = window.startCapture = window.initCapture = function() {
                    console.log('Recording functions disabled by host settings');
                    return false;
                };
            }
            
            restoreBeginCapture() {
                if (this.originalBeginCapture) {
                    window.beginCapture = this.originalBeginCapture;
                } else {
                    window.beginCapture = function() {
                        console.log('beginCapture function is now enabled');
                        if (recordingManager && recordingManager.isRecordingAllowed) {
                            recordingManager.startRecording();
                        }
                        return true;
                    };
                }
                
                delete window.startCapture;
                delete window.initCapture;
            }

            destroy() {
                if (this.pollInterval) {
                    clearInterval(this.pollInterval);
                }
                if (this.notificationTimeout) {
                    clearTimeout(this.notificationTimeout);
                }
                if (this.socket) {
                    this.socket.disconnect();
                }
            }
        }

        let recordingManager;
        
        document.addEventListener('DOMContentLoaded', () => {
            recordingManager = new RecordingButtonManager();
        });