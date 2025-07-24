// Meeting Lock functionality for Participants
class ParticipantLockManager {
  constructor(socket) {
    this.socket = socket;
    this.isLocked = false;
    this.setupSocketListeners();
  }

  setupSocketListeners() {
    this.socket.on('meeting-locked', (data) => {
      this.handleMeetingLocked(data);
    });

    this.socket.on('meeting-lock-changed', (data) => {
      this.isLocked = data.isLocked;
      this.showLockNotification(data);
    });

    this.socket.on('joined-meeting', (data) => {
      if (data.isLocked !== undefined) {
        this.isLocked = data.isLocked;
      }
    });
  }

  handleMeetingLocked(data) {
    // Clear the entire page content
    document.body.innerHTML = '';
    
    // Create the locked page content
    this.createLockedPage(data);
  }

  createLockedPage(data) {
    const lockedHTML = `
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #333;
          overflow: hidden;
        }

        .locked-container {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          border-radius: 24px;
          padding: 60px 40px;
          text-align: center;
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
          max-width: 500px;
          width: 90%;
          position: relative;
          animation: slideIn 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .lock-icon {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #ff6b6b, #ee5a24);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 30px;
          animation: pulse 2s infinite;
          box-shadow: 0 10px 30px rgba(255, 107, 107, 0.3);
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 10px 30px rgba(255, 107, 107, 0.3);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 15px 40px rgba(255, 107, 107, 0.4);
          }
        }

        .lock-icon i {
          font-size: 36px;
          color: white;
        }

        .locked-title {
          font-size: 32px;
          font-weight: 700;
          color: #2c3e50;
          margin-bottom: 16px;
          line-height: 1.2;
        }

        .locked-message {
          font-size: 18px;
          color: #5a6c7d;
          margin-bottom: 40px;
          line-height: 1.6;
          font-weight: 400;
        }

        .locked-details {
          background: rgba(116, 75, 162, 0.1);
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 40px;
          border-left: 4px solid #764ba2;
        }

        .locked-details h3 {
          font-size: 16px;
          font-weight: 600;
          color: #764ba2;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .locked-details p {
          font-size: 14px;
          color: #6c757d;
          line-height: 1.5;
        }

        .return-btn {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border: none;
          padding: 16px 32px;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
        }

        .return-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 35px rgba(102, 126, 234, 0.4);
          background: linear-gradient(135deg, #5a67d8, #6b46c1);
        }

        .return-btn:active {
          transform: translateY(0);
        }

        .floating-particles {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          overflow: hidden;
        }

        .particle {
          position: absolute;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 50%;
          animation: float 6s infinite linear;
        }

        @keyframes float {
          0% {
            transform: translateY(100vh) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-100px) rotate(360deg);
            opacity: 0;
          }
        }

        .meeting-info {
          background: rgba(255, 255, 255, 0.7);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 30px;
          border: 1px solid rgba(255, 255, 255, 0.3);
        }

        .meeting-info h4 {
          font-size: 14px;
          font-weight: 600;
          color: #495057;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .meeting-id {
          font-size: 20px;
          font-weight: 700;
          color: #2c3e50;
          font-family: 'Courier New', monospace;
          letter-spacing: 2px;
        }

        @media (max-width: 768px) {
          .locked-container {
            padding: 40px 24px;
            margin: 20px;
          }

          .locked-title {
            font-size: 28px;
          }

          .locked-message {
            font-size: 16px;
          }

          .lock-icon {
            width: 70px;
            height: 70px;
          }

          .lock-icon i {
            font-size: 30px;
          }
        }
      </style>
      
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
      
      <div class="floating-particles" id="particles"></div>
      
      <div class="locked-container">
        <div class="lock-icon">
          <i class="fas fa-lock"></i>
        </div>
        
        <h1 class="locked-title">Meeting Inaccessible</h1>
        <p class="locked-message">${data.message}</p>
        
        <div class="meeting-info">
          <h4>Meeting ID</h4>
          <div class="meeting-id">${data.meetingId || 'N/A'}</div>
        </div>
        
        <div class="locked-details">
          <h3>
            <i class="fas fa-info-circle"></i>
            What does this mean?
          </h3>
          <p>The meeting host has temporarily locked this meeting to prevent new participants from joining. This is a security feature to ensure only intended participants can access the meeting.</p>
        </div>
        
        <a href="/dashboard" class="return-btn">
          <i class="fas fa-arrow-left"></i>
          Return to Dashboard
        </a>
      </div>
    `;

    document.body.innerHTML = lockedHTML;
    
    // Create floating particles
    this.createParticles();
  }

  createParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;
    
    const particleCount = 20;
    
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      
      const size = Math.random() * 4 + 2;
      particle.style.width = size + 'px';
      particle.style.height = size + 'px';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.animationDelay = Math.random() * 6 + 's';
      particle.style.animationDuration = (Math.random() * 3 + 4) + 's';
      
      particlesContainer.appendChild(particle);
    }
  }

  showLockNotification(data) {
    // Only show notification if we're not on the locked page
    if (document.querySelector('.locked-container')) return;
    
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
      window.participantLockManager = new ParticipantLockManager(window.hostMeetingInstance.socket);
    } else {
      setTimeout(initializeLockManager, 100);
    }
  };
  
  initializeLockManager();
});