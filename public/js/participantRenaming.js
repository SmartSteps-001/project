// Participant Renaming System
class ParticipantRenaming {
    constructor(socket, meetingInstance) {
        this.socket = socket;
        this.meeting = meetingInstance;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupSocketListeners();
    }

    setupEventListeners() {
        // Change Name button event listener
        const changeNameBtn = document.querySelector('.test-btn-mic');
        const participantNameInput = document.getElementById('partiticpantName');
        
        if (changeNameBtn && participantNameInput) {
            changeNameBtn.addEventListener('click', () => {
                this.handleNameChange();
            });

            // Allow Enter key to trigger name change
            participantNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleNameChange();
                }
            });
        }

        // Host toggle for allowing participant renames
        const allowRenameToggle = document.querySelector('input[type="checkbox"]');
        if (allowRenameToggle && this.meeting.isHost) {
            allowRenameToggle.addEventListener('change', (e) => {
                this.handleRenamePermissionChange(e.target.checked);
            });
        }
    }

    setupSocketListeners() {
        // Listen for participant name changes
        this.socket.on('participant-renamed', (data) => {
            this.handleParticipantRenamed(data);
        });

        // Listen for permission changes
        this.socket.on('rename-permission-updated', (data) => {
            this.handleRenamePermissionUpdate(data);
        });

        // Listen for action errors
        this.socket.on('action-error', (data) => {
            this.showError(data.message);
        });
    }

    handleNameChange() {
        const participantNameInput = document.getElementById('partiticpantName');
        const newName = participantNameInput.value.trim();

        // Validate name
        if (!newName) {
            this.showError('Name cannot be empty');
            return;
        }

        if (newName.length > 50) {
            this.showError('Name must be 50 characters or less');
            return;
        }

        if (newName === this.meeting.userName) {
            this.showError('Name is already set to this value');
            return;
        }

        // Check if participant is allowed to rename (for non-hosts)
        if (!this.meeting.isHost && !this.meeting.meetingPermissions.allowRename) {
            this.showError('The host has disabled name changes');
            return;
        }

        // Emit rename event
        if (this.meeting.isHost) {
            this.socket.emit('host-rename-self', { newName: newName });
        } else {
            this.socket.emit('rename-participant', { newName: newName });
        }

        // Show loading state
        this.setRenameButtonState(true, 'Changing...');
    }

    handleRenamePermissionChange(allowed) {
        // Only hosts can change this permission
        if (!this.meeting.isHost) return;

        this.socket.emit('update-meeting-permissions', {
            permissions: {
                allowRename: allowed
            }
        });

        this.showSuccess(`Participant renaming ${allowed ? 'enabled' : 'disabled'}`);
    }

    handleParticipantRenamed(data) {
        const { socketId, oldName, newName, participants, isHost, renamedBy } = data;

        // Update participant in meeting instance
        if (this.meeting.participants && this.meeting.participants.has(socketId)) {
            const participant = this.meeting.participants.get(socketId);
            participant.name = newName;
        }

        // Update local user name if it's our own rename
        if (socketId === this.socket.id) {
            this.meeting.userName = newName;
            this.updateLocalNameDisplay(newName);
            this.setRenameButtonState(false, 'Change Name');
            this.showSuccess('Name changed successfully');
        }

        // Update UI displays
        this.updateParticipantDisplays(participants);
        
        // Show notification for other participants
        if (socketId !== this.socket.id) {
            const message = renamedBy 
                ? `${oldName} was renamed to ${newName} by ${renamedBy}`
                : `${oldName} changed their name to ${newName}`;
            this.showInfo(message);
        }

        // Update video wrappers
        this.updateVideoWrapperNames(socketId, newName);
    }

    handleRenamePermissionUpdate(data) {
        const { permissions, changedBy } = data;
        
        // Update meeting permissions
        if (this.meeting.meetingPermissions) {
            this.meeting.meetingPermissions.allowRename = permissions.allowRename;
        }

        // Update toggle state for host
        const allowRenameToggle = document.querySelector('input[type="checkbox"]');
        if (allowRenameToggle && this.meeting.isHost) {
            allowRenameToggle.checked = permissions.allowRename;
        }

        // Update participant UI state
        this.updateParticipantRenameUI(permissions.allowRename);

        // Show notification
        const message = `Name changing ${permissions.allowRename ? 'enabled' : 'disabled'} by ${changedBy}`;
        this.showInfo(message);
    }

    updateLocalNameDisplay(newName) {
        const participantNameInput = document.getElementById('partiticpantName');
        if (participantNameInput) {
            participantNameInput.value = newName;
        }
    }

    updateParticipantDisplays(participants) {
        // Update participants list if it exists
        if (this.meeting.renderParticipantsList) {
            this.meeting.renderParticipantsList();
        }

        // Update any other participant displays
        if (this.meeting.renderParticipants) {
            this.meeting.renderParticipants();
        }
    }

    updateVideoWrapperNames(socketId, newName) {
        const videoWrapper = document.querySelector(`[data-socket-id="${socketId}"]`);
        if (videoWrapper) {
            const nameElement = videoWrapper.querySelector('.participant-name');
            if (nameElement) {
                // Preserve role indicators
                const roleText = nameElement.textContent.includes('(Host)') ? ' (Host)' : 
                               nameElement.textContent.includes('(Co-Host)') ? ' (Co-Host)' : '';
                nameElement.textContent = newName + roleText;
            }
        }
    }

    updateParticipantRenameUI(allowRename) {
        const changeNameBtn = document.querySelector('.test-btn-mic');
        const participantNameInput = document.getElementById('partiticpantName');

        if (!this.meeting.isHost) {
            // Enable/disable rename UI for participants
            if (changeNameBtn) {
                changeNameBtn.disabled = !allowRename;
                changeNameBtn.title = allowRename ? 'Change your display name' : 'Host has disabled name changes';
            }
            if (participantNameInput) {
                participantNameInput.disabled = !allowRename;
            }
        }
    }

    setRenameButtonState(loading, text) {
        const changeNameBtn = document.querySelector('.test-btn-mic');
        if (changeNameBtn) {
            changeNameBtn.disabled = loading;
            changeNameBtn.textContent = text;
        }
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showInfo(message) {
        this.showToast(message, 'info');
    }

    showToast(message, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-message">${message}</span>
                <button class="toast-close">&times;</button>
            </div>
        `;

        // Add to document
        document.body.appendChild(toast);

        // Show toast
        setTimeout(() => toast.classList.add('show'), 100);

        // Auto-hide after 4 seconds
        const autoHide = setTimeout(() => {
            this.hideToast(toast);
        }, 4000);

        // Manual close
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            clearTimeout(autoHide);
            this.hideToast(toast);
        });
    }

    hideToast(toast) {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait for meeting instance to be available
    const checkMeetingInstance = () => {
        const meetingInstance = window.hostMeetingInstance || window.participantMeetingInstance;
        if (meetingInstance && meetingInstance.socket) {
            new ParticipantRenaming(meetingInstance.socket, meetingInstance);
        } else {
            setTimeout(checkMeetingInstance, 500);
        }
    };
    checkMeetingInstance();
});