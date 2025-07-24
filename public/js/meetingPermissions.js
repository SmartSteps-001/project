// Meeting Permissions Manager
class MeetingPermissions {
    constructor(socket, meetingInstance) {
        this.socket = socket;
        this.meeting = meetingInstance;
        this.permissions = {
            allowRename: true,
            allowUnmute: true,
            allowHandRaising: true,
            chatEnabled: true,
            fileSharing: true,
            emojiReactions: true,
            muteAllParticipants: false
        };
        this.init();
    }

    init() {
        this.setupPermissionControls();
        this.setupSocketListeners();
    }

    setupPermissionControls() {
        if (!this.meeting.isHost) return;

        // Allow participants to rename themselves toggle
        const allowRenameToggle = document.querySelector('#participants .setting-item input[type="checkbox"]');
        if (allowRenameToggle) {
            allowRenameToggle.addEventListener('change', (e) => {
                this.updatePermission('allowRename', e.target.checked);
            });
        }

        // Chat enable/disable toggle
        const chatToggle = document.querySelector('#chat .setting-item:first-child input[type="checkbox"]');
        if (chatToggle) {
            chatToggle.addEventListener('change', (e) => {
                this.updatePermission('chatEnabled', e.target.checked);
            });
        }

        // File sharing toggle
        const fileToggle = document.querySelector('#chat .setting-item:nth-child(4) input[type="checkbox"]');
        if (fileToggle) {
            fileToggle.addEventListener('change', (e) => {
                this.updatePermission('fileSharing', e.target.checked);
            });
        }

        // Emoji reactions toggle
        const emojiToggle = document.querySelector('#chat .setting-item:last-child input[type="checkbox"]');
        if (emojiToggle) {
            emojiToggle.addEventListener('change', (e) => {
                this.updatePermission('emojiReactions', e.target.checked);
            });
        }

        // Hand raising toggle
        const handRaisingToggle = document.querySelector('#handRaisingToggle');
        if (handRaisingToggle) {
            handRaisingToggle.addEventListener('change', (e) => {
                this.updatePermission('allowHandRaising', e.target.checked);
            });
        }
    }

    setupSocketListeners() {
        this.socket.on('meeting-permissions-updated', (data) => {
            this.handlePermissionsUpdate(data);
        });

        this.socket.on('rename-permission-updated', (data) => {
            this.handleRenamePermissionUpdate(data);
        });
    }

    updatePermission(permissionType, enabled) {
        this.permissions[permissionType] = enabled;
        
        this.socket.emit('update-meeting-permissions', {
            permissions: { [permissionType]: enabled }
        });

        // Show feedback to host
        const permissionNames = {
            allowRename: 'Participant Renaming',
            allowUnmute: 'Participant Unmuting',
            allowHandRaising: 'Hand Raising',
            chatEnabled: 'Chat',
            fileSharing: 'File Sharing',
            emojiReactions: 'Emoji Reactions',
            muteAllParticipants: 'Mute All Participants'
        };
        
        this.showToast(
            `${permissionNames[permissionType]} ${enabled ? 'enabled' : 'disabled'} for all participants`,
            'success'
        );
    }

    handlePermissionsUpdate(data) {
        const { permissions, changedBy, participants } = data;
        
        // Update local permissions
        this.permissions = { ...this.permissions, ...permissions };
        
        // Update meeting instance
        if (this.meeting.meetingPermissions) {
            this.meeting.meetingPermissions = { ...this.meeting.meetingPermissions, ...permissions };
        }

        // Update participant list if available
        if (this.meeting.participants) {
            participants.forEach(p => {
                this.meeting.participants.set(p.socketId, p);
            });
        }

        // Show notification
        this.showToast(`Meeting permissions updated by ${changedBy}`, 'info');
    }

    handleRenamePermissionUpdate(data) {
        const { permissions, changedBy } = data;
        
        // Update rename permission
        this.permissions.allowRename = permissions.allowRename;
        
        // Update toggle state
        const allowRenameToggle = document.querySelector('#participants .setting-item input[type="checkbox"]');
        if (allowRenameToggle) {
            allowRenameToggle.checked = permissions.allowRename;
        }

        // Update participant rename UI
        this.updateParticipantRenameUI(permissions.allowRename);

        // Show notification
        const message = `Name changing ${permissions.allowRename ? 'enabled' : 'disabled'} by ${changedBy}`;
        this.showToast(message, 'info');
    }

    updateParticipantRenameUI(allowRename) {
        if (this.meeting.isHost) return; // Host is always allowed to rename

        const changeNameBtn = document.querySelector('.test-btn-mic');
        const participantNameInput = document.getElementById('partiticpantName');

        if (changeNameBtn) {
            changeNameBtn.disabled = !allowRename;
            changeNameBtn.title = allowRename ? 
                'Change your display name' : 
                'Host has disabled name changes';
        }

        if (participantNameInput) {
            participantNameInput.disabled = !allowRename;
            participantNameInput.placeholder = allowRename ? 
                'Enter your name' : 
                'Name changes disabled';
        }
    }

    getPermissions() {
        return { ...this.permissions };
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

        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 100);

        const autoHide = setTimeout(() => {
            this.hideToast(toast);
        }, 4000);

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

// Initialize permissions manager
document.addEventListener('DOMContentLoaded', () => {
    const checkMeetingInstance = () => {
        const meetingInstance = window.hostMeetingInstance || window.participantMeetingInstance;
        if (meetingInstance && meetingInstance.socket) {
            new MeetingPermissions(meetingInstance.socket, meetingInstance);
        } else {
            setTimeout(checkMeetingInstance, 500);
        }
    };
    checkMeetingInstance();
});