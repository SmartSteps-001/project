// Host-specific recording control functionality
class HostRecordingControl {
  constructor() {
    this.meetingId = null;
    this.recordingPermissionClient = null;
    this.init();
  }

  init() {
    // Wait for recording permission client to be available
    this.waitForRecordingClient();
    this.setupSettingsIntegration();
  }

  waitForRecordingClient() {
    if (window.recordingPermissionClient) {
      this.recordingPermissionClient = window.recordingPermissionClient;
      this.recordingPermissionClient.setMeetingInfo(this.meetingId, true);
    } else {
      setTimeout(() => this.waitForRecordingClient(), 100);
    }
  }

  setMeetingId(meetingId) {
    this.meetingId = meetingId;
    if (this.recordingPermissionClient) {
      this.recordingPermissionClient.setMeetingInfo(meetingId, true);
    }
  }

  setupSettingsIntegration() {
    // Find the recording dropdown in meeting settings
    const recordingDropdown = document.querySelector('#meeting .setting-item:has(span:contains("Record meeting")) .dropdown');
    
    if (recordingDropdown) {
      // Set initial value
      recordingDropdown.value = 'Don\'t Record';
      
      // Add change listener
      recordingDropdown.addEventListener('change', (e) => {
        const recordingAllowed = e.target.value === 'Record to Computer';
        this.updateRecordingPermission(recordingAllowed);
      });
    }

    // Alternative selector if the above doesn't work
    const allDropdowns = document.querySelectorAll('#meeting .dropdown');
    allDropdowns.forEach(dropdown => {
      const parentItem = dropdown.closest('.setting-item');
      if (parentItem && parentItem.textContent.includes('Record meeting')) {
        dropdown.addEventListener('change', (e) => {
          const recordingAllowed = e.target.value === 'Record to Computer';
          this.updateRecordingPermission(recordingAllowed);
        });
      }
    });
  }

  updateRecordingPermission(recordingAllowed) {
    if (this.recordingPermissionClient) {
      this.recordingPermissionClient.updateRecordingPermission(recordingAllowed);
    }

    // Show confirmation to host
    const message = recordingAllowed 
      ? 'Recording enabled for all participants' 
      : 'Recording disabled for all participants';
    
    this.showHostNotification(message);
  }

  showHostNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'toast-notification';
    notification.innerHTML = `
      <i class="fas fa-video"></i>
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

// Initialize host recording control
let hostRecordingControl;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Only initialize on host page
  if (document.title.includes('Host Meeting')) {
    hostRecordingControl = new HostRecordingControl();
    
    // Set meeting ID when available
    if (window.meetingId) {
      hostRecordingControl.setMeetingId(window.meetingId);
    }
  }
});

// Export for use in other scripts
window.HostRecordingControl = HostRecordingControl;