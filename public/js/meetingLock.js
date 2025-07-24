// Meeting Lock functionality for Host
class MeetingLockManager {
  constructor(socket) {
    this.socket = socket;
    this.isLocked = false;
    this.setupEventListeners();
    this.setupSocketListeners();
  }

  setupEventListeners() {
    // Find the lock meeting toggle in settings
    const lockToggle = document.querySelector('#meeting .setting-item input[type="checkbox"]');
    if (lockToggle) {
      lockToggle.addEventListener('change', (e) => {
        this.toggleMeetingLock(e.target.checked);
      });
    }

    // Also check for the lock button in taskbar
    const lockButton = document.getElementById('lockMeetingToggle');
    if (lockButton) {
      lockButton.addEventListener('click', () => {
        this.toggleMeetingLock(!this.isLocked);
      });
    }
  }

  setupSocketListeners() {
    this.socket.on('meeting-lock-changed', (data) => {
      this.isLocked = data.isLocked;
      this.updateLockUI();
      this.showLockNotification(data);
    });

    this.socket.on('joined-meeting', (data) => {
      if (data.isLocked !== undefined) {
        this.isLocked = data.isLocked;
        this.updateLockUI();
      }
    });
  }

  toggleMeetingLock(shouldLock) {
    this.socket.emit('toggle-meeting-lock', { isLocked: shouldLock });
  }

  updateLockUI() {
    // Update settings toggle
    const lockToggle = document.querySelector('#meeting .setting-item input[type="checkbox"]');
    if (lockToggle) {
      lockToggle.checked = this.isLocked;
    }

    // Update taskbar lock button
    const lockButton = document.getElementById('vortex-primary-activator-3k7s');
    if (lockButton) {
      const icon = lockButton.querySelector('i');
      if (this.isLocked) {
        icon.className = 'fas fa-lock';
        lockButton.style.background = '#dc2626';
        lockButton.title = 'Meeting is locked - Click to unlock';
      } else {
        icon.className = 'fas fa-lock-open';
        lockButton.style.background = 'rgba(51, 65, 85, 0.8)';
        lockButton.title = 'Meeting is unlocked - Click to lock';
      }
    }

    // Update any other UI elements that show lock status
    this.updateLockIndicators();
  }

  updateLockIndicators() {
    // Add a visual indicator to the meeting title or somewhere prominent
    const meetingTitle = document.getElementById('meetingTitle');
    if (meetingTitle) {
      const existingIndicator = meetingTitle.querySelector('.lock-indicator');
      if (existingIndicator) {
        existingIndicator.remove();
      }

      if (this.isLocked) {
        const lockIndicator = document.createElement('span');
        lockIndicator.className = 'lock-indicator';
        lockIndicator.innerHTML = ' <i class="fas fa-lock" style="color: #dc2626; margin-left: 8px;"></i>';
        lockIndicator.title = 'Meeting is locked';
        meetingTitle.appendChild(lockIndicator);
      }
    }
  }

  showLockNotification(data) {
    const message = data.isLocked 
      ? `Meeting locked by ${data.changedBy}. New participants cannot join.`
      : `Meeting unlocked by ${data.changedBy}. New participants can now join.`;
    
    this.showToast(message, data.isLocked ? 'warning' : 'success');
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'warning' ? '#f59e0b' : type === 'success' ? '#10b981' : '#3b82f6'};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      z-index: 1001;
      opacity: 0;
      transform: translateX(100px);
      transition: all 0.3s ease;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    }, 100);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100px)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Wait for socket to be available
  const initializeLockManager = () => {
    if (window.io && window.hostMeetingInstance && window.hostMeetingInstance.socket) {
      window.meetingLockManager = new MeetingLockManager(window.hostMeetingInstance.socket);
    } else {
      setTimeout(initializeLockManager, 100);
    }
  };
  
  initializeLockManager();
});