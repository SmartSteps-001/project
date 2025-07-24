
  // renamingParticipant.js - Fixed to work with the backend

class ParticipantRenamer {
  constructor() {
    this.socket = null;
    this.hostMeetingInstance = null;
    this.initialized = false;
    
    // Wait for the main meeting instance to be ready
    this.waitForMeetingInstance();
  }

  waitForMeetingInstance() {
    const checkForInstance = () => {
      if (window.hostMeetingInstance && window.hostMeetingInstance.socket) {
        this.socket = window.hostMeetingInstance.socket;
        this.hostMeetingInstance = window.hostMeetingInstance;
        this.init();
      } else {
        // Keep checking every 500ms until the instance is available
        setTimeout(checkForInstance, 500);
      }
    };
    
    checkForInstance();
  }

  init() {
    if (this.initialized) return;
    
    this.setupSocketListeners();
    this.setupEventListeners();
    this.initializeNameInput();
    
    this.initialized = true;
    console.log('ParticipantRenamer initialized successfully');
  }

  setupSocketListeners() {
    // Listen for participant renamed events from server (matches backend)
    this.socket.on('participant-renamed', (data) => {
      console.log('Participant renamed:', data);
      
      // Update the host meeting participants
      if (this.hostMeetingInstance && this.hostMeetingInstance.updateParticipants) {
        this.hostMeetingInstance.updateParticipants(data.participants);
      }
      
      // If it's the current user who changed name, update local references
      if (data.socketId === this.socket.id) {
        if (this.hostMeetingInstance) {
          this.hostMeetingInstance.userName = data.newName;
        }
        window.myName = data.newName;
        
        // Update the input field
        const nameInput = document.getElementById('partiticpantName');
        if (nameInput) {
          nameInput.value = data.newName;
        }
      }
      
      // Show toast notification
      if (data.renamedBy) {
        this.showToast(`${data.oldName} was renamed to ${data.newName} by ${data.renamedBy}`);
      } else if (data.isHost) {
        this.showToast(`Host changed name from ${data.oldName} to ${data.newName}`);
      } else {
        this.showToast(`${data.oldName} changed name to ${data.newName}`);
      }
    });

    // Listen for action errors
    this.socket.on('action-error', (data) => {
      console.error('Action error:', data);
      this.showToast(data.message || 'An error occurred', 'error');
    });

    // Listen for rename permission updates
    this.socket.on('rename-permission-updated', (data) => {
      console.log('Rename permission updated:', data);
      if (!data.permissions.allowRename) {
        this.showToast('Host disabled name changing', 'info');
        // Optionally disable the button
        const changeNameBtn = document.querySelector('.test-btn-mic');
        if (changeNameBtn) {
          changeNameBtn.disabled = true;
          changeNameBtn.style.opacity = '0.5';
        }
      } else {
        this.showToast('Host enabled name changing', 'info');
        // Re-enable the button
        const changeNameBtn = document.querySelector('.test-btn-mic');
        if (changeNameBtn) {
          changeNameBtn.disabled = false;
          changeNameBtn.style.opacity = '1';
        }
      }
    });
  }

  setupEventListeners() {
    // Name change button event
    const changeNameBtn = document.querySelector('.test-btn-mic');
    if (changeNameBtn) {
      changeNameBtn.addEventListener('click', () => {
        this.changeName();
      });
      console.log('Name change button listener attached');
    } else {
      console.warn('Name change button (.test-btn-mic) not found');
    }

    // Enter key support for name input
    const nameInput = document.getElementById('partiticpantName');
    if (nameInput) {
      nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.changeName();
        }
      });
      console.log('Name input enter key listener attached');
    } else {
      console.warn('Name input (#partiticpantName) not found');
    }
  }

  initializeNameInput() {
    const nameInput = document.getElementById('partiticpantName');
    if (nameInput && this.hostMeetingInstance && this.hostMeetingInstance.userName) {
      nameInput.value = this.hostMeetingInstance.userName;
      console.log('Name input initialized with:', this.hostMeetingInstance.userName);
    }
  }

  changeName() {
    const nameInput = document.getElementById('partiticpantName');
    if (!nameInput) {
      console.error('Name input element not found');
      this.showToast('Name input not found', 'error');
      return;
    }
    
    const newName = nameInput.value.trim();
    const currentName = this.hostMeetingInstance ? this.hostMeetingInstance.userName : window.myName;
    
    // Validate the new name
    if (!newName) {
      this.showToast('Please enter a valid name', 'error');
      nameInput.focus();
      return;
    }
    
    if (newName.length > 50) {
      this.showToast('Name is too long (max 50 characters)', 'error');
      nameInput.focus();
      return;
    }
    
    if (newName === currentName) {
      this.showToast('That is already your current name', 'info');
      return;
    }
    
    // Check if name is already taken by another participant
    if (this.hostMeetingInstance && this.hostMeetingInstance.participants) {
      const existingParticipant = Array.from(this.hostMeetingInstance.participants.values())
        .find(p => p.name.toLowerCase() === newName.toLowerCase() && p.socketId !== this.socket.id);
        
      if (existingParticipant) {
        this.showToast('This name is already taken by another participant', 'error');
        nameInput.focus();
        return;
      }
    }
    
    // Determine if user is host and send appropriate event
    const isHost = this.hostMeetingInstance && this.hostMeetingInstance.isHost;
    
    if (isHost) {
      // Host renaming themselves
      console.log('Sending host rename request:', { newName });
      this.socket.emit('host-rename-self', {
        newName: newName
      });
    } else {
      // Regular participant renaming themselves
      console.log('Sending participant rename request:', { newName });
      this.socket.emit('rename-participant', {
        newName: newName
      });
    }
    
    // Show loading state
    this.showToast('Changing name...', 'info');
  }

  showToast(message, type = 'success') {
    // Use the host meeting's toast method if available
    if (this.hostMeetingInstance && this.hostMeetingInstance.showToast) {
      this.hostMeetingInstance.showToast(message, type);
      return;
    }
    
    // Fallback toast implementation
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'error' : type === 'info' ? 'info' : 'success'}`;
    toast.textContent = message;
    
    // Basic styling for the toast
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'error' ? '#ff4757' : type === 'info' ? '#3742fa' : '#2ed573'};
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      font-size: 14px;
      z-index: 10000;
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease;
      max-width: 300px;
      word-wrap: break-word;
    `;
    
    document.body.appendChild(toast);
    
    // Show toast
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    }, 100);
    
    // Hide and remove toast
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }
}

// Initialize the renamer when the page loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing ParticipantRenamer...');
  new ParticipantRenamer();
});

// Also initialize if DOM is already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing ParticipantRenamer...');
    new ParticipantRenamer();
  });
} else {
  console.log('DOM already loaded, initializing ParticipantRenamer...');
  new ParticipantRenamer();
}
