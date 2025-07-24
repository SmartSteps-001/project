// Host Waiting Room UI Module
// This module adds waiting room management UI to the host interface

export const setupHostWaitingRoomUI = () => {
  // Add waiting room panel to host interface
  const createWaitingRoomPanel = () => {
    const waitingRoomHTML = `
      <div class="waiting-room-panel" id="waitingRoomPanel" style="display: none;">
        <div class="waiting-room-header">
          <div class="waiting-room-title">
            <i class="fas fa-clock"></i>
            Waiting Room (<span id="waitingRoomCount">0</span>)
          </div>
          <div class="waiting-room-controls">
            <button class="btn btn-sm btn-primary" id="admitAllBtn">
              <i class="fas fa-check-double"></i> Admit All
            </button>
            <button class="btn btn-sm btn-secondary" id="waitingRoomSettingsBtn">
              <i class="fas fa-cog"></i>
            </button>
            <button class="btn btn-sm btn-secondary" id="closeWaitingRoomPanel">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
        
        <div class="waiting-room-settings" id="waitingRoomSettings" style="display: none;">
          <div class="setting-group">
            <label class="setting-label">
              <input type="checkbox" id="enableWaitingRoom" checked>
              Enable Waiting Room
            </label>
          </div>
          
          <div class="setting-group">
            <label class="setting-label">
              <input type="checkbox" id="muteOnEntry">
              Mute participants when they join
            </label>
          </div>
          
          <div class="setting-group">
            <label for="welcomeMessage">Welcome Message:</label>
            <textarea id="welcomeMessage" rows="3" placeholder="Enter welcome message for waiting participants...">Welcome! Please wait while the host admits you to the meeting.</textarea>
          </div>
          
          <div class="setting-actions">
            <button class="btn btn-primary" id="saveWaitingRoomSettings">Save Settings</button>
          </div>
        </div>
        
        <div class="waiting-participants-list" id="waitingParticipantsList">
          <div class="empty-waiting-room" id="emptyWaitingRoom">
            <i class="fas fa-user-clock"></i>
            <p>No participants waiting</p>
          </div>
        </div>
      </div>
    `;

    // Add to the host interface
    const hostContainer = document.querySelector('.video-call-app');
    if (hostContainer) {
      hostContainer.insertAdjacentHTML('beforeend', waitingRoomHTML);
    }
  };

  // Add waiting room toggle button to taskbar
  const addWaitingRoomButton = () => {
    const taskbarCenter = document.querySelector('.taskbar-center');
    if (taskbarCenter) {
      const waitingRoomBtn = document.createElement('button');
      waitingRoomBtn.className = 'control-btn';
      waitingRoomBtn.id = 'waitingRoomToggleBtn';
      waitingRoomBtn.innerHTML = `
        <i class="fas fa-clock"></i>
        <span class="waiting-count" id="waitingCount" style="display: none;">0</span>
      `;
      waitingRoomBtn.title = 'Waiting Room';
      
      // Insert before participants button
      const participantsBtn = document.getElementById('memberToggleBtn');
      if (participantsBtn) {
        taskbarCenter.insertBefore(waitingRoomBtn, participantsBtn);
      } else {
        taskbarCenter.appendChild(waitingRoomBtn);
      }
    }
  };

  // Add notification system for waiting room
  const createNotificationSystem = () => {
    const notificationHTML = `
      <div class="waiting-room-notifications" id="waitingRoomNotifications">
        <!-- Notifications will be added here -->
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', notificationHTML);
  };

  // Waiting Room Manager Class
  class WaitingRoomManager {
    constructor(socket, meetingId) {
      this.socket = socket;
      this.meetingId = meetingId;
      this.waitingParticipants = new Map();
      this.panelOpen = false;
      this.settingsOpen = false;
      
      this.init();
    }

    init() {
      this.setupEventListeners();
      this.setupSocketListeners();
      this.loadWaitingRoomParticipants();
    }

    setupEventListeners() {
      // Toggle waiting room panel
      document.getElementById('waitingRoomToggleBtn')?.addEventListener('click', () => {
        this.togglePanel();
      });

      // Close panel
      document.getElementById('closeWaitingRoomPanel')?.addEventListener('click', () => {
        this.closePanel();
      });

      // Settings toggle
      document.getElementById('waitingRoomSettingsBtn')?.addEventListener('click', () => {
        this.toggleSettings();
      });

      // Admit all participants
      document.getElementById('admitAllBtn')?.addEventListener('click', () => {
        this.admitAllParticipants();
      });

      // Save settings
      document.getElementById('saveWaitingRoomSettings')?.addEventListener('click', () => {
        this.saveSettings();
      });

      // Enable/disable waiting room
      document.getElementById('enableWaitingRoom')?.addEventListener('change', (e) => {
        this.toggleWaitingRoom(e.target.checked);
      });
    }

    setupSocketListeners() {
      // New participant in waiting room
      this.socket.on('waiting-room-participant-joined', (data) => {
        this.addWaitingParticipant(data);
        this.showNotification(`${data.name} is waiting to join`, 'info');
        this.updateWaitingCount();
      });

      // Participant left waiting room
      this.socket.on('waiting-room-participant-left', (data) => {
        this.removeWaitingParticipant(data.socketId);
        this.updateWaitingCount();
      });

      // Waiting room participants list
      this.socket.on('waiting-room-participants-list', (data) => {
        this.updateWaitingParticipantsList(data.participants);
        this.updateWaitingCount();
      });

      // Non-intrusive notification
      this.socket.on('waiting-room-notification', (data) => {
        this.showSubtleNotification(data);
      });

      // Settings updated
      this.socket.on('waiting-room-settings-updated', (data) => {
        this.updateSettingsUI(data.settings);
      });
    }

    loadWaitingRoomParticipants() {
      this.socket.emit('get-waiting-room-participants', {
        meetingId: this.meetingId
      });
    }

    togglePanel() {
      const panel = document.getElementById('waitingRoomPanel');
      if (this.panelOpen) {
        this.closePanel();
      } else {
        this.openPanel();
      }
    }

    openPanel() {
      const panel = document.getElementById('waitingRoomPanel');
      panel.style.display = 'block';
      panel.style.position = 'fixed';
      panel.style.top = '80px';
      panel.style.right = '20px';
      panel.style.width = '350px';
      panel.style.maxHeight = '500px';
      panel.style.background = 'rgba(30, 41, 59, 0.98)';
      panel.style.backdropFilter = 'blur(20px)';
      panel.style.border = '1px solid rgba(71, 85, 105, 0.3)';
      panel.style.borderRadius = '12px';
      panel.style.zIndex = '1000';
      panel.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.5)';
      
      this.panelOpen = true;
      this.loadWaitingRoomParticipants();
    }

    closePanel() {
      const panel = document.getElementById('waitingRoomPanel');
      panel.style.display = 'none';
      this.panelOpen = false;
      this.settingsOpen = false;
      
      const settings = document.getElementById('waitingRoomSettings');
      if (settings) settings.style.display = 'none';
    }

    toggleSettings() {
      const settings = document.getElementById('waitingRoomSettings');
      this.settingsOpen = !this.settingsOpen;
      settings.style.display = this.settingsOpen ? 'block' : 'none';
    }

    addWaitingParticipant(participantData) {
      this.waitingParticipants.set(participantData.socketId, participantData);
      this.renderWaitingParticipants();
    }

    removeWaitingParticipant(socketId) {
      this.waitingParticipants.delete(socketId);
      this.renderWaitingParticipants();
    }

    updateWaitingParticipantsList(participants) {
      this.waitingParticipants.clear();
      participants.forEach(p => {
        this.waitingParticipants.set(p.socketId, p);
      });
      this.renderWaitingParticipants();
    }

    renderWaitingParticipants() {
      const list = document.getElementById('waitingParticipantsList');
      const emptyState = document.getElementById('emptyWaitingRoom');
      
      if (this.waitingParticipants.size === 0) {
        emptyState.style.display = 'block';
        return;
      }
      
      emptyState.style.display = 'none';
      
      const participantsHTML = Array.from(this.waitingParticipants.values()).map(participant => `
        <div class="waiting-participant-item" data-socket-id="${participant.socketId}">
          <div class="participant-info">
            <div class="participant-avatar">
              ${participant.name.split(' ').map(n => n[0]).join('').toUpperCase()}
            </div>
            <div class="participant-details">
              <div class="participant-name">${participant.name}</div>
              <div class="participant-waiting-time">
                Waiting ${this.getWaitingTime(participant.joinedAt)}
              </div>
            </div>
          </div>
          <div class="participant-actions">
            <button class="btn btn-sm btn-success" onclick="waitingRoomManager.admitParticipant('${participant.socketId}')">
              <i class="fas fa-check"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="waitingRoomManager.denyParticipant('${participant.socketId}')">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
      `).join('');
      
      list.innerHTML = participantsHTML;
    }

    getWaitingTime(joinedAt) {
      const now = new Date();
      const joined = new Date(joinedAt);
      const diffMs = now - joined;
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return 'just now';
      if (diffMins === 1) return '1 minute';
      return `${diffMins} minutes`;
    }

    updateWaitingCount() {
      const count = this.waitingParticipants.size;
      const countElement = document.getElementById('waitingCount');
      const roomCountElement = document.getElementById('waitingRoomCount');
      
      if (count > 0) {
        countElement.textContent = count;
        countElement.style.display = 'block';
        if (roomCountElement) roomCountElement.textContent = count;
      } else {
        countElement.style.display = 'none';
        if (roomCountElement) roomCountElement.textContent = '0';
      }
    }

    admitParticipant(socketId) {
      this.socket.emit('admit-participant', {
        meetingId: this.meetingId,
        participantSocketId: socketId
      });
    }

    denyParticipant(socketId, reason = 'Access denied by host') {
      this.socket.emit('deny-participant', {
        meetingId: this.meetingId,
        participantSocketId: socketId,
        reason: reason
      });
    }

    admitAllParticipants() {
      if (this.waitingParticipants.size === 0) return;
      
      this.socket.emit('admit-all-participants', {
        meetingId: this.meetingId
      });
    }

    toggleWaitingRoom(enabled) {
      this.socket.emit('update-waiting-room-settings', {
        meetingId: this.meetingId,
        settings: { enabled }
      });
    }

    saveSettings() {
      const enableWaitingRoom = document.getElementById('enableWaitingRoom').checked;
      const muteOnEntry = document.getElementById('muteOnEntry').checked;
      const welcomeMessage = document.getElementById('welcomeMessage').value;
      
      this.socket.emit('update-waiting-room-settings', {
        meetingId: this.meetingId,
        settings: {
          enabled: enableWaitingRoom,
          muteOnEntry: muteOnEntry,
          welcomeMessage: welcomeMessage
        }
      });
      
      this.showNotification('Settings saved successfully', 'success');
    }

    updateSettingsUI(settings) {
      document.getElementById('enableWaitingRoom').checked = settings.enabled;
      document.getElementById('muteOnEntry').checked = settings.muteOnEntry;
      document.getElementById('welcomeMessage').value = settings.welcomeMessage;
    }

    showNotification(message, type = 'info') {
      const notification = document.createElement('div');
      notification.className = `notification notification-${type}`;
      notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span>${message}</span>
      `;
      
      const container = document.getElementById('waitingRoomNotifications');
      container.appendChild(notification);
      
      setTimeout(() => {
        notification.classList.add('show');
      }, 100);
      
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
      }, 4000);
    }

    showSubtleNotification(data) {
      // Show a subtle, non-intrusive notification
      const subtleNotification = document.createElement('div');
      subtleNotification.className = 'subtle-notification';
      subtleNotification.innerHTML = `
        <i class="fas fa-user-plus"></i>
        <span>${data.participantName} joined waiting room</span>
      `;
      
      subtleNotification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(59, 130, 246, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        z-index: 1001;
        opacity: 0;
        transform: translateX(100px);
        transition: all 0.3s ease;
      `;
      
      document.body.appendChild(subtleNotification);
      
      setTimeout(() => {
        subtleNotification.style.opacity = '1';
        subtleNotification.style.transform = 'translateX(0)';
      }, 100);
      
      setTimeout(() => {
        subtleNotification.style.opacity = '0';
        subtleNotification.style.transform = 'translateX(100px)';
        setTimeout(() => subtleNotification.remove(), 300);
      }, 3000);
    }
  }

  // Initialize waiting room UI
  const initializeWaitingRoomUI = (socket, meetingId) => {
    createWaitingRoomPanel();
    addWaitingRoomButton();
    createNotificationSystem();
    
    // Create global waiting room manager
    window.waitingRoomManager = new WaitingRoomManager(socket, meetingId);
    
    return window.waitingRoomManager;
  };

  return {
    initializeWaitingRoomUI,
    WaitingRoomManager
  };
};

// CSS for waiting room UI
const waitingRoomCSS = `
  .waiting-room-panel {
    padding: 20px;
    overflow-y: auto;
  }

  .waiting-room-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid rgba(71, 85, 105, 0.3);
  }

  .waiting-room-title {
    font-size: 16px;
    font-weight: 600;
    color: #f1f5f9;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .waiting-room-controls {
    display: flex;
    gap: 8px;
  }

  .waiting-room-settings {
    background: rgba(51, 65, 85, 0.5);
    border-radius: 8px;
    padding: 15px;
    margin-bottom: 20px;
  }

  .setting-group {
    margin-bottom: 15px;
  }

  .setting-label {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #e2e8f0;
    font-size: 14px;
    cursor: pointer;
  }

  .setting-label input[type="checkbox"] {
    margin: 0;
  }

  .setting-group label {
    display: block;
    color: #e2e8f0;
    font-size: 14px;
    margin-bottom: 5px;
  }

  .setting-group textarea {
    width: 100%;
    padding: 8px;
    background: rgba(30, 41, 59, 0.8);
    border: 1px solid rgba(71, 85, 105, 0.5);
    border-radius: 6px;
    color: #f1f5f9;
    font-size: 12px;
    resize: vertical;
  }

  .setting-actions {
    text-align: right;
  }

  .waiting-participants-list {
    max-height: 300px;
    overflow-y: auto;
  }

  .empty-waiting-room {
    text-align: center;
    padding: 40px 20px;
    color: #94a3b8;
  }

  .empty-waiting-room i {
    font-size: 32px;
    margin-bottom: 10px;
    opacity: 0.5;
  }

  .waiting-participant-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    background: rgba(51, 65, 85, 0.3);
    border-radius: 8px;
    margin-bottom: 8px;
  }

  .participant-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .participant-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    font-size: 12px;
  }

  .participant-details {
    display: flex;
    flex-direction: column;
  }

  .participant-name {
    font-size: 14px;
    font-weight: 500;
    color: #f1f5f9;
  }

  .participant-waiting-time {
    font-size: 12px;
    color: #94a3b8;
  }

  .participant-actions {
    display: flex;
    gap: 6px;
  }

  .btn {
    padding: 6px 12px;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-sm {
    padding: 4px 8px;
    font-size: 11px;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover {
    background: #2563eb;
  }

  .btn-secondary {
    background: rgba(71, 85, 105, 0.8);
    color: #e2e8f0;
  }

  .btn-secondary:hover {
    background: rgba(71, 85, 105, 1);
  }

  .btn-success {
    background: #10b981;
    color: white;
  }

  .btn-success:hover {
    background: #059669;
  }

  .btn-danger {
    background: #ef4444;
    color: white;
  }

  .btn-danger:hover {
    background: #dc2626;
  }

  .waiting-count {
    position: absolute;
    top: -8px;
    right: -8px;
    background: #ef4444;
    color: white;
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 10px;
    min-width: 18px;
    text-align: center;
  }

  .waiting-room-notifications {
    position: fixed;
    top: 80px;
    right: 20px;
    z-index: 1002;
    pointer-events: none;
  }

  .notification {
    background: rgba(30, 41, 59, 0.95);
    border: 1px solid rgba(71, 85, 105, 0.3);
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: #f1f5f9;
    font-size: 14px;
    opacity: 0;
    transform: translateX(100px);
    transition: all 0.3s ease;
    pointer-events: auto;
  }

  .notification.show {
    opacity: 1;
    transform: translateX(0);
  }

  .notification-success {
    border-color: rgba(16, 185, 129, 0.5);
    background: rgba(16, 185, 129, 0.1);
  }

  .notification-error {
    border-color: rgba(239, 68, 68, 0.5);
    background: rgba(239, 68, 68, 0.1);
  }

  .notification-info {
    border-color: rgba(59, 130, 246, 0.5);
    background: rgba(59, 130, 246, 0.1);
  }
`;

// Inject CSS
const style = document.createElement('style');
style.textContent = waitingRoomCSS;
document.head.appendChild(style);