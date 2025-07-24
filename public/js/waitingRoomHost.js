class WaitingRoomHost {
    constructor() {
        this.socket = null;
        this.meetingId = null;
        this.waitingParticipants = new Map();
        this.settings = {
            enabled: true,
            welcomeMessage: "Welcome to the meeting! Please wait while the host admits you.",
            autoAdmit: false,
            mutedOnEntry: true
        };
        
        this.init();
    }

    init() {
        // Get socket and meeting ID from parent window/context
        if (window.hostMeetingInstance) {
            this.socket = window.hostMeetingInstance.socket;
            this.meetingId = window.hostMeetingInstance.meetingId;
            this.setupSocketListeners();
            this.setupUI();
            this.loadSettings();
        } else {
            // Retry after a short delay
            setTimeout(() => this.init(), 1000);
        }
    }

    setupSocketListeners() {
        this.socket.on('waiting-room-notification', (data) => {
            this.handleWaitingRoomNotification(data);
        });

        this.socket.on('waiting-room-participants', (data) => {
            this.updateWaitingParticipants(data.participants);
        });

        this.socket.on('participant-admitted', (data) => {
            this.removeParticipantFromWaiting(data.participantId);
        });

        this.socket.on('participant-denied', (data) => {
            this.removeParticipantFromWaiting(data.participantId);
        });

        this.socket.on('waiting-room-settings-updated', (data) => {
            if (data.success) {
                this.showNotification('Waiting room settings updated', 'success');
            }
        });

        // Notify server that host has joined
        this.socket.emit('host-joined-meeting', { meetingId: this.meetingId });
    }

    setupUI() {
        this.createWaitingRoomUI();
        this.bindEvents();
    }

    createWaitingRoomUI() {
        // Create waiting room panel
        const waitingRoomPanel = document.createElement('div');
        waitingRoomPanel.id = 'waitingRoomPanel';
        waitingRoomPanel.className = 'waiting-room-panel';
        waitingRoomPanel.innerHTML = `
            <div class="waiting-room-header">
                <h3><i class="fas fa-users-clock"></i> Waiting Room</h3>
                <div class="waiting-room-controls">
                    <button id="waitingRoomSettings" class="btn-icon" title="Waiting Room Settings">
                        <i class="fas fa-cog"></i>
                    </button>
                    <button id="toggleWaitingRoom" class="btn-icon" title="Toggle Waiting Room">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </div>
            <div class="waiting-participants-list" id="waitingParticipantsList">
                <div class="empty-waiting-room">
                    <i class="fas fa-user-clock"></i>
                    <p>No participants waiting</p>
                </div>
            </div>
        `;

        // Add to page
        document.body.appendChild(waitingRoomPanel);

        // Create settings modal
        this.createSettingsModal();

        // Create notification indicator
        this.createNotificationIndicator();
    }

    createSettingsModal() {
        const modal = document.createElement('div');
        modal.id = 'waitingRoomSettingsModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-cog"></i> Waiting Room Settings</h3>
                    <button class="close-btn" id="closeWaitingRoomSettings">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="setting-group">
                        <label class="setting-item">
                            <input type="checkbox" id="enableWaitingRoom" ${this.settings.enabled ? 'checked' : ''}>
                            <span class="checkmark"></span>
                            Enable Waiting Room
                        </label>
                        <p class="setting-description">Participants will wait for approval before joining</p>
                    </div>
                    
                    <div class="setting-group">
                        <label for="welcomeMessage">Welcome Message</label>
                        <textarea id="welcomeMessage" placeholder="Enter a welcome message for waiting participants" rows="3">${this.settings.welcomeMessage}</textarea>
                    </div>
                    
                    <div class="setting-group">
                        <label class="setting-item">
                            <input type="checkbox" id="autoAdmit" ${this.settings.autoAdmit ? 'checked' : ''}>
                            <span class="checkmark"></span>
                            Auto-admit participants
                        </label>
                        <p class="setting-description">Automatically admit participants without approval</p>
                    </div>
                    
                    <div class="setting-group">
                        <label class="setting-item">
                            <input type="checkbox" id="mutedOnEntry" ${this.settings.mutedOnEntry ? 'checked' : ''}>
                            <span class="checkmark"></span>
                            Mute participants on entry
                        </label>
                        <p class="setting-description">Participants will join muted</p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="cancelWaitingRoomSettings">Cancel</button>
                    <button class="btn btn-primary" id="saveWaitingRoomSettings">Save Settings</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    createNotificationIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'waitingRoomIndicator';
        indicator.className = 'waiting-room-indicator';
        indicator.innerHTML = `
            <div class="indicator-content">
                <i class="fas fa-user-clock"></i>
                <span class="indicator-count">0</span>
            </div>
        `;

        // Position it near the participants button
        const participantsBtn = document.getElementById('memberToggleBtn');
        if (participantsBtn) {
            participantsBtn.parentNode.insertBefore(indicator, participantsBtn.nextSibling);
        }
    }

    bindEvents() {
        // Settings button
        document.getElementById('waitingRoomSettings').addEventListener('click', () => {
            this.showSettingsModal();
        });

        // Toggle waiting room panel
        document.getElementById('toggleWaitingRoom').addEventListener('click', () => {
            this.toggleWaitingRoomPanel();
        });

        // Settings modal events
        document.getElementById('closeWaitingRoomSettings').addEventListener('click', () => {
            this.hideSettingsModal();
        });

        document.getElementById('cancelWaitingRoomSettings').addEventListener('click', () => {
            this.hideSettingsModal();
        });

        document.getElementById('saveWaitingRoomSettings').addEventListener('click', () => {
            this.saveSettings();
        });

        // Notification indicator click
        document.getElementById('waitingRoomIndicator').addEventListener('click', () => {
            this.showWaitingRoomPanel();
        });
    }

    handleWaitingRoomNotification(data) {
        if (data.type === 'participant-joined') {
            this.addParticipantToWaiting(data.participant);
            this.showSubtleNotification(`${data.participant.name} is waiting to join`, 'info');
        } else if (data.type === 'participant-left') {
            this.removeParticipantFromWaiting(data.participant.socketId);
        }

        this.updateIndicator(data.waitingCount || this.waitingParticipants.size);
    }

    addParticipantToWaiting(participant) {
        this.waitingParticipants.set(participant.socketId, participant);
        this.renderWaitingParticipants();
    }

    removeParticipantFromWaiting(socketId) {
        this.waitingParticipants.delete(socketId);
        this.renderWaitingParticipants();
        this.updateIndicator(this.waitingParticipants.size);
    }

    updateWaitingParticipants(participants) {
        this.waitingParticipants.clear();
        participants.forEach(p => {
            this.waitingParticipants.set(p.socketId, p);
        });
        this.renderWaitingParticipants();
        this.updateIndicator(this.waitingParticipants.size);
    }

    renderWaitingParticipants() {
        const container = document.getElementById('waitingParticipantsList');
        
        if (this.waitingParticipants.size === 0) {
            container.innerHTML = `
                <div class="empty-waiting-room">
                    <i class="fas fa-user-clock"></i>
                    <p>No participants waiting</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        
        this.waitingParticipants.forEach(participant => {
            const participantElement = this.createParticipantElement(participant);
            container.appendChild(participantElement);
        });
    }

    createParticipantElement(participant) {
        const element = document.createElement('div');
        element.className = 'waiting-participant';
        element.dataset.socketId = participant.socketId;

        const initials = participant.name.split(' ').map(n => n[0]).join('').toUpperCase();
        const joinTime = new Date(participant.joinedAt).toLocaleTimeString();

        element.innerHTML = `
            <div class="participant-avatar">${initials}</div>
            <div class="participant-info">
                <div class="participant-name">${participant.name}</div>
                <div class="participant-time">Waiting since ${joinTime}</div>
            </div>
            <div class="participant-actions">
                <button class="btn btn-success btn-sm" onclick="waitingRoomHost.admitParticipant('${participant.socketId}')" title="Admit">
                    <i class="fas fa-check"></i>
                </button>
                <button class="btn btn-danger btn-sm" onclick="waitingRoomHost.denyParticipant('${participant.socketId}')" title="Deny">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        return element;
    }

    admitParticipant(socketId) {
        console.log('Admitting participant:', socketId);
        this.socket.emit('admit-participant', {
            meetingId: this.meetingId,
            participantId: socketId
        });

        const participant = this.waitingParticipants.get(socketId);
        if (participant) {
            this.showNotification(`${participant.name} admitted to meeting`, 'success');
        }
    }

    denyParticipant(socketId, reason = 'Entry denied by host') {
        const participant = this.waitingParticipants.get(socketId);
        
        if (participant) {
            const customReason = prompt(`Deny ${participant.name}? Enter reason (optional):`, reason);
            if (customReason !== null) {
                this.socket.emit('deny-participant', {
                    meetingId: this.meetingId,
                    participantId: socketId,
                    reason: customReason || reason
                });

                this.showNotification(`${participant.name} denied entry`, 'info');
            }
        }
    }

    showSettingsModal() {
        document.getElementById('waitingRoomSettingsModal').style.display = 'flex';
    }

    hideSettingsModal() {
        document.getElementById('waitingRoomSettingsModal').style.display = 'none';
    }

    saveSettings() {
        const newSettings = {
            enabled: document.getElementById('enableWaitingRoom').checked,
            welcomeMessage: document.getElementById('welcomeMessage').value,
            autoAdmit: document.getElementById('autoAdmit').checked,
            mutedOnEntry: document.getElementById('mutedOnEntry').checked
        };

        this.settings = { ...newSettings };

        this.socket.emit('update-waiting-room-settings', {
            meetingId: this.meetingId,
            settings: newSettings
        });

        this.hideSettingsModal();
    }

    loadSettings() {
        // Request current settings from server
        this.socket.emit('get-waiting-room-settings', { meetingId: this.meetingId });
    }

    toggleWaitingRoomPanel() {
        const panel = document.getElementById('waitingRoomPanel');
        panel.classList.toggle('visible');
    }

    showWaitingRoomPanel() {
        const panel = document.getElementById('waitingRoomPanel');
        panel.classList.add('visible');
    }

    updateIndicator(count) {
        const indicator = document.getElementById('waitingRoomIndicator');
        const countElement = indicator.querySelector('.indicator-count');
        
        countElement.textContent = count;
        
        if (count > 0) {
            indicator.classList.add('has-waiting');
            indicator.style.display = 'flex';
        } else {
            indicator.classList.remove('has-waiting');
            indicator.style.display = 'none';
        }
    }

    showSubtleNotification(message, type = 'info') {
        // Create a subtle notification that doesn't interrupt the meeting
        const notification = document.createElement('div');
        notification.className = `subtle-notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-user-clock"></i>
            <span>${message}</span>
        `;

        document.body.appendChild(notification);

        // Auto-remove after 4 seconds
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }

    showNotification(message, type = 'success') {
        // Standard notification
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => notification.classList.add('show'), 100);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// CSS for waiting room components
const waitingRoomCSS = `
    .waiting-room-panel {
        position: fixed;
        top: 50%;
        right: -350px;
        transform: translateY(-50%);
        width: 350px;
        max-height: 500px;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(20px);
        border-radius: 16px 0 0 16px;
        box-shadow: -10px 0 30px rgba(0, 0, 0, 0.1);
        transition: right 0.3s ease;
        z-index: 1000;
        overflow: hidden;
    }

    .waiting-room-panel.visible {
        right: 0;
    }

    .waiting-room-header {
        padding: 20px;
        border-bottom: 2px solid #e5e7eb;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
    }

    .waiting-room-header h3 {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 600;
    }

    .waiting-room-controls {
        display: flex;
        gap: 10px;
    }

    .waiting-participants-list {
        max-height: 400px;
        overflow-y: auto;
        padding: 10px;
    }

    .waiting-participant {
        display: flex;
        align-items: center;
        padding: 15px;
        border-radius: 12px;
        margin-bottom: 10px;
        background: rgba(255, 255, 255, 0.8);
        border: 2px solid #e5e7eb;
        transition: all 0.3s ease;
    }

    .waiting-participant:hover {
        border-color: #667eea;
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
    }

    .waiting-participant .participant-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        margin-right: 15px;
    }

    .waiting-participant .participant-info {
        flex: 1;
    }

    .waiting-participant .participant-name {
        font-weight: 600;
        color: #333;
        margin-bottom: 4px;
    }

    .waiting-participant .participant-time {
        font-size: 0.8rem;
        color: #666;
    }

    .waiting-participant .participant-actions {
        display: flex;
        gap: 8px;
    }

    .empty-waiting-room {
        text-align: center;
        padding: 40px 20px;
        color: #666;
    }

    .empty-waiting-room i {
        font-size: 3rem;
        margin-bottom: 15px;
        opacity: 0.5;
    }

    .waiting-room-indicator {
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        border-radius: 50px;
        padding: 12px 20px;
        cursor: pointer;
        transition: all 0.3s ease;
        z-index: 999;
        display: none;
        align-items: center;
        gap: 10px;
        box-shadow: 0 5px 20px rgba(102, 126, 234, 0.3);
    }

    .waiting-room-indicator:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
    }

    .waiting-room-indicator.has-waiting {
        animation: pulse 2s infinite;
    }

    .indicator-count {
        background: rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.8rem;
        font-weight: 600;
    }

    .subtle-notification {
        position: fixed;
        top: 80px;
        right: 20px;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        border-radius: 12px;
        padding: 15px 20px;
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
        border-left: 4px solid #667eea;
        z-index: 1001;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideInRight 0.3s ease;
        max-width: 300px;
    }

    .subtle-notification.fade-out {
        animation: slideOutRight 0.3s ease;
    }

    .subtle-notification.info {
        border-left-color: #3b82f6;
    }

    .subtle-notification.success {
        border-left-color: #10b981;
    }

    .subtle-notification.warning {
        border-left-color: #f59e0b;
    }

    @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
    }

    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }

    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }

    .btn-icon {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        border-radius: 8px;
        padding: 8px;
        color: white;
        cursor: pointer;
        transition: all 0.3s ease;
    }

    .btn-icon:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: scale(1.1);
    }

    .btn-sm {
        padding: 6px 12px;
        font-size: 0.8rem;
        border-radius: 6px;
    }

    .btn {
        padding: 8px 16px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.3s ease;
    }

    .btn-success {
        background: #10b981;
        color: white;
    }

    .btn-success:hover {
        background: #059669;
        transform: translateY(-1px);
    }

    .btn-danger {
        background: #ef4444;
        color: white;
    }

    .btn-danger:hover {
        background: #dc2626;
        transform: translateY(-1px);
    }

    .btn-primary {
        background: #667eea;
        color: white;
    }

    .btn-primary:hover {
        background: #5a67d8;
    }

    .btn-secondary {
        background: #6b7280;
        color: white;
    }

    .btn-secondary:hover {
        background: #4b5563;
    }

    .setting-group {
        margin-bottom: 25px;
    }

    .setting-group label {
        display: block;
        font-weight: 600;
        margin-bottom: 8px;
        color: #333;
    }

    .setting-group textarea {
        width: 100%;
        padding: 12px;
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        font-family: inherit;
        resize: vertical;
        transition: border-color 0.3s ease;
    }

    .setting-group textarea:focus {
        outline: none;
        border-color: #667eea;
    }

    .setting-item {
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        font-weight: 500;
    }

    .setting-description {
        margin-top: 5px;
        font-size: 0.9rem;
        color: #666;
        margin-left: 30px;
    }

    .checkmark {
        width: 20px;
        height: 20px;
        border: 2px solid #667eea;
        border-radius: 4px;
        position: relative;
        transition: all 0.3s ease;
    }

    .setting-item input[type="checkbox"] {
        display: none;
    }

    .setting-item input[type="checkbox"]:checked + .checkmark {
        background: #667eea;
    }

    .setting-item input[type="checkbox"]:checked + .checkmark::after {
        content: '✓';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: white;
        font-size: 12px;
        font-weight: bold;
    }

    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 2000;
    }

    .modal-content {
        background: white;
        border-radius: 16px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }

    .modal-header {
        padding: 20px;
        border-bottom: 2px solid #e5e7eb;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        border-radius: 16px 16px 0 0;
    }

    .modal-header h3 {
        margin: 0;
        font-size: 1.2rem;
    }

    .close-btn {
        background: none;
        border: none;
        color: white;
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background 0.3s ease;
    }

    .close-btn:hover {
        background: rgba(255, 255, 255, 0.2);
    }

    .modal-body {
        padding: 30px;
    }

    .modal-footer {
        padding: 20px 30px;
        border-top: 2px solid #e5e7eb;
        display: flex;
        gap: 10px;
        justify-content: flex-end;
    }

    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        border-radius: 12px;
        padding: 15px 20px;
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
        border-left: 4px solid #10b981;
        z-index: 1001;
        transform: translateX(100%);
        opacity: 0;
        transition: all 0.3s ease;
        max-width: 300px;
    }

    .notification.show {
        transform: translateX(0);
        opacity: 1;
    }

    .notification.success {
        border-left-color: #10b981;
    }

    .notification.info {
        border-left-color: #3b82f6;
    }

    .notification.warning {
        border-left-color: #f59e0b;
    }

    .notification.error {
        border-left-color: #ef4444;
    }
`;

// Inject CSS
const style = document.createElement('style');
style.textContent = waitingRoomCSS;
document.head.appendChild(style);

// Initialize waiting room host when page loads
let waitingRoomHost;
document.addEventListener('DOMContentLoaded', () => {
    waitingRoomHost = new WaitingRoomHost();
    window.waitingRoomHost = waitingRoomHost; // Make globally accessible
});