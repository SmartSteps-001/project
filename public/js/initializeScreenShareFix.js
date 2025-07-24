// Initialize all screen share audio fixes
document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing comprehensive screen share audio fix...');
  
  // Wait for all dependencies to load
  const initializeAll = () => {
    // Check if WebRTC manager is available
    const webrtcManager = window.hostMeetingInstance?.webrtc || 
                         window.participantMeetingInstance?.webrtc ||
                         window.webrtcManager;
    
    if (webrtcManager) {
      console.log('WebRTC manager found, initializing screen share fixes...');
      
      // Initialize enhanced screen share if not already done
      if (!window.enhancedScreenShare) {
        window.enhancedScreenShare = new EnhancedScreenShareManager(webrtcManager);
      }
      
      // Set up audio level monitoring for screen share
      if (window.audioMixingEngine && window.enhancedScreenShare) {
        window.audioMixingEngine.startAudioLevelMonitoring((levels) => {
          // Update any audio level displays
          const audioBar = document.querySelector('.screen-share-audio-bar');
          if (audioBar) {
            audioBar.style.width = `${levels.rms * 100}%`;
          }
        });
      }
      
      // Add keyboard shortcut for screen share (Ctrl+Shift+S)
      document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'S') {
          e.preventDefault();
          if (window.enhancedScreenShare) {
            window.enhancedScreenShare.toggleScreenShare();
          }
        }
      });
      
      // Add keyboard shortcut for audio help (Ctrl+Shift+A)
      document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'A') {
          e.preventDefault();
          if (window.screenShareAudioHelper) {
            window.screenShareAudioHelper.showTroubleshootingGuide();
          }
        }
      });
      
      console.log('✅ Screen share audio fixes initialized successfully');
      
      // Show initialization success
      setTimeout(() => {
        const notification = document.createElement('div');
        notification.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          padding: 12px 16px;
          border-radius: 8px;
          z-index: 10001;
          font-size: 14px;
          font-weight: 500;
          opacity: 0;
          transform: translateX(100%);
          transition: all 0.3s ease;
        `;
        
        notification.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-check-circle"></i>
            <span>Screen share audio fixes loaded</span>
          </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
          notification.style.opacity = '1';
          notification.style.transform = 'translateX(0)';
        }, 100);
        
        setTimeout(() => {
          notification.style.opacity = '0';
          notification.style.transform = 'translateX(100%)';
          setTimeout(() => {
            if (notification.parentNode) {
              notification.parentNode.removeChild(notification);
            }
          }, 300);
        }, 3000);
      }, 2000);
      
    } else {
      // Retry after a delay
      setTimeout(initializeAll, 500);
    }
  };
  
  // Start initialization
  initializeAll();
});

// Add global helper functions
window.fixScreenShareAudio = () => {
  console.log('Manual screen share audio fix triggered');
  
  if (window.screenShareAudioHelper) {
    window.screenShareAudioHelper.showTroubleshootingGuide();
  } else {
    alert('Screen share audio helper not loaded yet. Please wait a moment and try again.');
  }
};

window.testScreenShareAudioCapture = () => {
  if (window.screenShareAudioFix) {
    window.screenShareAudioFix.testAudioCapture();
  } else {
    console.error('Screen share audio fix not loaded');
  }
};

// Add CSS for better integration
const style = document.createElement('style');
style.textContent = `
  .audio-helper-btn:hover {
    background: rgba(59, 130, 246, 0.3) !important;
    transform: translateY(-1px);
  }
  
  .screen-share-audio-bar {
    transition: width 0.1s ease, background-color 0.3s ease;
  }
  
  .screen-share-audio-bar.active {
    background: linear-gradient(90deg, #10b981, #3b82f6) !important;
    box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
  }
  
  @keyframes audioActivity {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  
  .audio-active {
    animation: audioActivity 1s infinite;
  }
`;
document.head.appendChild(style);

console.log('Screen share audio initialization script loaded');