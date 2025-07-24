class ScreenShareManager {
  constructor(socket) {
    this.socket = socket;
    this.isHost = false;
    this.settings = {
      allowScreenShare: true,
      requirePermission: true
    };
    this.pendingRequest = null;
    this.isScreenSharing = false;
    
    this.setupSocketListeners();
  }

  setupSocketListeners() {
    // Settings updated
    this.socket.on('screen-share-settings-updated', (settings) => {
      this.settings = settings;
      this.updateUI();
      this.showNotification(
        `Screen sharing ${settings.allowScreenShare ? 'enabled' : 'disabled'} by host`,
        settings.allowScreenShare ? 'info' : 'warning'
      );
    });

    // Permission request (for host)
    this.socket.on('screen-share-permission-request', (data) => {
      this.showPermissionRequest(data);
    });

    // Permission response (for participant)
    this.socket.on('screen-share-permission-response', (data) => {
      this.handlePermissionResponse(data);
    });

    // Permission pending
    this.socket.on('screen-share-permission-pending', (data) => {
      this.pendingRequest = data.requestId;
      this.showNotification('Permission request sent to host. Waiting for approval...', 'info');
      this.updateScreenShareButton('pending');
    });

    // Permission granted
    this.socket.on('screen-share-permission-granted', () => {
      this.showNotification('Screen sharing permission granted!', 'success');
      this.startScreenShare();
    });

    // Permission denied
    this.socket.on('screen-share-permission-denied', (data) => {
      this.showNotification(`Screen sharing denied: ${data.reason}`, 'error');
      this.updateScreenShareButton('disabled');
    });

    // Screen share started/stopped by others
    this.socket.on('participant-started-screen-share', (data) => {
      this.showNotification('A participant started sharing their screen', 'info');
    });

    this.socket.on('participant-stopped-screen-share', (data) => {
      this.showNotification('A participant stopped sharing their screen', 'info');
    });

    // Current settings
    this.socket.on('screen-share-settings', (settings) => {
      this.settings = settings;
      this.isHost = settings.isHost;
      this.updateUI();
    });

    // Errors
    this.socket.on('screen-share-error', (data) => {
      this.showNotification(`Error: ${data.message}`, 'error');
    });
  }

  // Initialize for host
  initializeAsHost() {
    this.isHost = true;
    this.setupHostControls();
    this.requestCurrentSettings();
  }

  // Initialize for participant
  initializeAsParticipant() {
    this.isHost = false;
    this.requestCurrentSettings();
  }

  // Request current settings
  requestCurrentSettings() {
    const meetingId = this.getMeetingId();
    if (meetingId) {
      this.socket.emit('get-screen-share-settings', { meetingId });
    }
  }

  // Update settings (host only)
  updateSettings(newSettings) {
    if (!this.isHost) return;

    const meetingId = this.getMeetingId();
    if (meetingId) {
      this.socket.emit('update-screen-share-settings', {
        meetingId,
        settings: newSettings
      });
    }
  }

  // Request screen share permission
  async requestScreenShare() {
    if (!this.settings.allowScreenShare) {
      this.showNotification('Screen sharing is disabled by the host', 'error');
      return;
    }

    if (this.isScreenSharing) {
      this.stopScreenShare();
      return;
    }

    const meetingId = this.getMeetingId();
    const participantName = this.getParticipantName();

    if (this.isHost || !this.settings.requirePermission) {
      // Host or no permission required - start directly
      this.startScreenShare();
    } else {
      // Request permission
      this.socket.emit('request-screen-share-permission', {
        meetingId,
        participantName
      });
    }
  }

  // Start screen sharing
  async startScreenShare() {
    try {
      // This would integrate with your existing WebRTC screen share logic
      if (window.hostMeetingInstance && window.hostMeetingInstance.webrtc) {
        await window.hostMeetingInstance.webrtc.startScreenShare();
      }

      this.isScreenSharing = true;
      this.updateScreenShareButton('active');

      const meetingId = this.getMeetingId();
      this.socket.emit('start-screen-share-request', { meetingId });

    } catch (error) {
      console.error('Failed to start screen share:', error);
      this.showNotification('Failed to start screen sharing', 'error');
    }
  }

  // Stop screen sharing
  async stopScreenShare() {
    try {
      // This would integrate with your existing WebRTC screen share logic
      if (window.hostMeetingInstance && window.hostMeetingInstance.webrtc) {
        await window.hostMeetingInstance.webrtc.stopScreenShare();
      }

      this.isScreenSharing = false;
      this.updateScreenShareButton('inactive');

      const meetingId = this.getMeetingId();
      this.socket.emit('stop-screen-share-request', { meetingId });

    } catch (error) {
      console.error('Failed to stop screen share:', error);
    }
  }

  // Show permission request modal (for host)
  showPermissionRequest(data) {
    const modal = document.createElement('div');
    modal.className = 'permission-request-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Screen Share Request</h3>
        </div>
        <div class="modal-body">
          <p><strong>${data.participantName}</strong> wants to share their screen.</p>
          <p>Do you want to allow this?</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="this.closest('.permission-request-modal').remove()">
            Deny
          </button>
          <button class="btn btn-primary" onclick="window.screenShareManager.approveRequest('${data.requestId}', '${data.participantName}')">
            Allow
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Auto-remove after 30 seconds
    setTimeout(() => {
      if (modal.parentNode) {
        modal.remove();
        this.denyRequest(data.requestId, data.participantName);
      }
    }, 30000);
  }

  // Approve permission request
  approveRequest(requestId, participantName) {
    this.socket.emit('respond-screen-share-request', {
      requestId,
      approved: true
    });

    // Remove modal
    const modal = document.querySelector('.permission-request-modal');
    if (modal) modal.remove();

    this.showNotification(`Approved screen sharing for ${participantName}`, 'success');
  }

  // Deny permission request
  denyRequest(requestId, participantName) {
    this.socket.emit('respond-screen-share-request', {
      requestId,
      approved: false
    });

    // Remove modal
    const modal = document.querySelector('.permission-request-modal');
    if (modal) modal.remove();

    this.showNotification(`Denied screen sharing for ${participantName}`, 'info');
  }

  // Handle permission response
  handlePermissionResponse(data) {
    this.pendingRequest = null;

    if (data.approved) {
      this.showNotification('Permission granted! Starting screen share...', 'success');
      this.startScreenShare();
    } else {
      this.showNotification('Permission denied by host', 'error');
      this.updateScreenShareButton('disabled');
    }
  }

  // Setup host controls
  setupHostControls() {
    // Add event listeners to the settings toggles
    const allowToggle = document.querySelector('#screen input[type="checkbox"]:first-of-type');
    const permissionToggle = document.querySelector('#screen input[type="checkbox"]:nth-of-type(2)');

    if (allowToggle) {
      allowToggle.addEventListener('change', (e) => {
        this.updateSettings({ allowScreenShare: e.target.checked });
        
        // Update permission toggle state
        if (permissionToggle) {
          permissionToggle.disabled = !e.target.checked;
          if (!e.target.checked) {
            permissionToggle.checked = false;
            this.updateSettings({ requirePermission: false });
          }
        }
      });
    }

    if (permissionToggle) {
      permissionToggle.addEventListener('change', (e) => {
        this.updateSettings({ requirePermission: e.target.checked });
      });
    }
  }

  // Update UI based on current settings
  updateUI() {
    const allowToggle = document.querySelector('#screen input[type="checkbox"]:first-of-type');
    const permissionToggle = document.querySelector('#screen input[type="checkbox"]:nth-of-type(2)');

    if (allowToggle) {
      allowToggle.checked = this.settings.allowScreenShare;
    }

    if (permissionToggle) {
      permissionToggle.checked = this.settings.requirePermission;
      permissionToggle.disabled = !this.settings.allowScreenShare;
    }

    this.updateScreenShareButton();
  }

  // Update screen share button state
  updateScreenShareButton(state = null) {
    const button = document.getElementById('screenShareBtn');
    if (!button) return;

    if (state === null) {
      if (!this.settings.allowScreenShare && !this.isHost) {
        state = 'disabled';
      } else if (this.isScreenSharing) {
        state = 'active';
      } else if (this.pendingRequest) {
        state = 'pending';
      } else {
        state = 'inactive';
      }
    }

    // Remove all state classes
    button.classList.remove('disabled', 'pending', 'active');
    button.disabled = false;

    switch (state) {
      case 'disabled':
        button.classList.add('disabled');
        button.disabled = true;
        button.title = 'Screen sharing is disabled';
        break;
      case 'pending':
        button.classList.add('pending');
        button.title = 'Waiting for permission...';
        break;
      case 'active':
        button.classList.add('active');
        button.setAttribute('data-active', 'true');
        button.title = 'Stop screen sharing';
        break;
      case 'inactive':
        button.setAttribute('data-active', 'false');
        button.title = 'Share screen';
        break;
    }
  }

  // Utility methods
  getMeetingId() {
    return window.location.pathname.split('/').pop();
  }

  getParticipantName() {
    return window.myName || 'Unknown Participant';
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `screen-share-notification ${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <i class="fas fa-desktop"></i>
        <span>${message}</span>
        <button class="close-btn" onclick="this.parentElement.parentElement.remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;

    // Add to page
    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Wait for socket to be available
  const initScreenShare = () => {
    if (window.io && (window.hostMeetingInstance || window.participantMeetingInstance)) {
      const socket = window.hostMeetingInstance ? 
        window.hostMeetingInstance.socket : 
        window.participantMeetingInstance.socket;
      
      window.screenShareManager = new ScreenShareManager(socket);
      
      if (window.hostMeetingInstance) {
        window.screenShareManager.initializeAsHost();
      } else {
        window.screenShareManager.initializeAsParticipant();
      }

      // Override the existing screen share button click
      const screenShareBtn = document.getElementById('screenShareBtn');
      if (screenShareBtn) {
        screenShareBtn.addEventListener('click', (e) => {
          e.preventDefault();
          window.screenShareManager.requestScreenShare();
        });
      }
    } else {
      setTimeout(initScreenShare, 100);
    }
  };

  initScreenShare();
});