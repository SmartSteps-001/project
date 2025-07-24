// Recording Permission Client-side Handler
class RecordingPermissionClient {
  constructor() {
    this.socket = null;
    this.recordingAllowed = false;
    this.meetingId = null;
    this.isHost = false;
    this.recordButton = null;
    
    this.init();
  }

  init() {
    // Wait for socket to be available
    if (typeof io !== 'undefined') {
      this.socket = io();
      this.setupSocketListeners();
    } else {
      // Retry after a short delay if socket.io is not loaded yet
      setTimeout(() => this.init(), 100);
    }

    // Setup DOM elements
    this.setupDOMElements();
  }

  setupDOMElements() {
    // Find the record button
    this.recordButton = document.getElementById('startCaptureBtn');
    
    if (this.recordButton) {
      // Add click handler to check permissions before recording
      this.recordButton.addEventListener('click', (e) => {
        this.handleRecordButtonClick(e);
      });
    }

    // Setup settings dropdown handler for hosts
    this.setupSettingsHandler();
  }

  setupSettingsHandler() {
    // Find the recording dropdown in settings
    const recordingDropdown = document.querySelector('#meeting .dropdown');
    
    if (recordingDropdown) {
      recordingDropdown.addEventListener('change', (e) => {
        if (this.isHost) {
          const recordingAllowed = e.target.value === 'Record to Computer';
          this.updateRecordingPermission(recordingAllowed);
        }
      });
    }
  }

  setupSocketListeners() {
    if (!this.socket) return;

    // Listen for recording permission status
    this.socket.on('recording-permission-status', (data) => {
      this.recordingAllowed = data.recordingAllowed;
      this.updateRecordButtonState();
    });

    // Listen for recording permission updates
    this.socket.on('recording-permission-updated', (data) => {
      this.recordingAllowed = data.recordingAllowed;
      this.updateRecordButtonState();
      this.showPermissionNotification(data.recordingAllowed);
    });

    // Join meeting for recording permissions
    this.socket.on('connect', () => {
      if (this.meetingId) {
        this.socket.emit('join-meeting-recording', { meetingId: this.meetingId });
      }
    });
  }

  // Set meeting information
  setMeetingInfo(meetingId, isHost = false) {
    this.meetingId = meetingId;
    this.isHost = isHost;
    
    if (this.socket && this.socket.connected) {
      this.socket.emit('join-meeting-recording', { meetingId });
    }

    // Check initial permission status
    this.checkRecordingPermission();
  }

  // Update recording permission (host only)
  updateRecordingPermission(recordingAllowed) {
    if (!this.isHost || !this.socket || !this.meetingId) return;

    this.socket.emit('update-recording-permission', {
      meetingId: this.meetingId,
      recordingAllowed
    });

    // Update local state for host
    this.recordingAllowed = recordingAllowed;
    this.updateRecordButtonState();
  }

  // Check current recording permission
  checkRecordingPermission() {
    if (this.socket) {
      this.socket.emit('check-recording-permission');
    }
  }

  // Handle record button click
  handleRecordButtonClick(e) {
    if (!this.recordingAllowed && !this.isHost) {
      e.preventDefault();
      e.stopPropagation();
      this.showPermissionDeniedMessage();
      return false;
    }
    
    // Allow recording to proceed
    return true;
  }

  // Update record button visual state
  updateRecordButtonState() {
    if (!this.recordButton) return;

    const iconContainer = this.recordButton.querySelector('.nebula-icon-container-5w7k');
    const textElement = this.recordButton.querySelector('.celestial-tool-text-8k3m');

    if (this.recordingAllowed || this.isHost) {
      // Enable recording
      this.recordButton.style.opacity = '1';
      this.recordButton.style.cursor = 'pointer';
      this.recordButton.title = 'Record Meeting';
      
      if (iconContainer) {
        iconContainer.style.opacity = '1';
      }
    } else {
      // Disable recording
      this.recordButton.style.opacity = '0.5';
      this.recordButton.style.cursor = 'not-allowed';
      this.recordButton.title = 'Recording disabled by host';
      
      if (iconContainer) {
        iconContainer.style.opacity = '0.5';
      }
    }
  }

  // Show permission denied message
  showPermissionDeniedMessage() {
    this.showNotification('Recording is disabled by the meeting host', 'warning');
  }

  // Show permission change notification
  showPermissionNotification(allowed) {
    const message = allowed 
      ? 'Recording has been enabled by the host' 
      : 'Recording has been disabled by the host';
    
    this.showNotification(message, allowed ? 'success' : 'warning');
  }

  // Show notification to user
  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `toast-notification ${type}`;
    notification.innerHTML = `
      <i class="fas fa-${type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
      <span>${message}</span>
    `;

    // Add to page
    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }
}

// Initialize recording permission client
let recordingPermissionClient;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  recordingPermissionClient = new RecordingPermissionClient();
});

// Export for use in other scripts
window.RecordingPermissionClient = RecordingPermissionClient;