// Screen Share Audio Fix - Ensures computer audio is always captured and transmitted
class ScreenShareAudioFix {
  constructor() {
    this.isInitialized = false;
    this.originalGetDisplayMedia = null;
    this.audioCaptureMethods = [];
    
    this.init();
  }

  init() {
    this.setupAudioCaptureMethods();
    this.patchGetDisplayMedia();
    this.setupScreenShareInstructions();
    this.monitorScreenShareEvents();
  }

  setupAudioCaptureMethods() {
    // Method 1: Standard getDisplayMedia with audio
    this.audioCaptureMethods.push({
      name: 'Standard Audio Capture',
      constraints: {
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000,
          channelCount: 2
        }
      }
    });

    // Method 2: Chrome-specific desktop audio capture
    this.audioCaptureMethods.push({
      name: 'Chrome Desktop Audio',
      constraints: {
        video: true,
        audio: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: 'screen'
          }
        }
      }
    });

    // Method 3: High-quality audio capture
    this.audioCaptureMethods.push({
      name: 'High Quality Audio',
      constraints: {
        video: {
          cursor: 'always',
          displaySurface: 'monitor'
        },
        audio: {
          sampleRate: 48000,
          channelCount: 2,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          latency: 0
        }
      }
    });
  }

  patchGetDisplayMedia() {
    // Store original method
    this.originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);

    // Override getDisplayMedia to ensure audio capture
    navigator.mediaDevices.getDisplayMedia = async (constraints) => {
      console.log('Enhanced getDisplayMedia called with constraints:', constraints);

      // Try each audio capture method until one works
      for (const method of this.audioCaptureMethods) {
        try {
          console.log(`Trying ${method.name}...`);
          
          const stream = await this.originalGetDisplayMedia(method.constraints);
          const audioTracks = stream.getAudioTracks();
          const videoTracks = stream.getVideoTracks();

          console.log(`${method.name} result: ${videoTracks.length} video, ${audioTracks.length} audio tracks`);

          if (audioTracks.length > 0) {
            console.log(`✅ ${method.name} successful - audio captured!`);
            this.showAudioCaptureSuccess(method.name);
            return stream;
          } else {
            console.log(`⚠️ ${method.name} - no audio captured`);
            // Continue to next method
            stream.getTracks().forEach(track => track.stop());
          }

        } catch (error) {
          console.log(`❌ ${method.name} failed:`, error.message);
          // Continue to next method
        }
      }

      // If all methods failed to capture audio, show instructions
      console.warn('All audio capture methods failed, showing user instructions');
      this.showAudioCaptureInstructions();

      // Return video-only stream as fallback
      try {
        return await this.originalGetDisplayMedia({
          video: true,
          audio: false
        });
      } catch (error) {
        console.error('Even video-only capture failed:', error);
        throw error;
      }
    };

    console.log('getDisplayMedia patched for enhanced audio capture');
  }

  setupScreenShareInstructions() {
    // Create instruction modal for users
    const instructionModal = document.createElement('div');
    instructionModal.id = 'screen-share-audio-instructions';
    instructionModal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(10px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    `;

    instructionModal.innerHTML = `
      <div style="
        background: white;
        border-radius: 16px;
        padding: 32px;
        max-width: 500px;
        width: 90%;
        text-align: center;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      ">
        <div style="
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
        ">
          <i class="fas fa-volume-up" style="font-size: 32px; color: white;"></i>
        </div>
        
        <h2 style="color: #1f2937; margin-bottom: 16px; font-size: 24px; font-weight: 700;">
          Enable Computer Audio Sharing
        </h2>
        
        <p style="color: #6b7280; margin-bottom: 24px; line-height: 1.6; font-size: 16px;">
          To share your computer audio with other participants, please follow these steps:
        </p>
        
        <div style="text-align: left; margin-bottom: 24px;">
          <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px;">
            <div style="
              width: 24px;
              height: 24px;
              background: #3b82f6;
              color: white;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              font-weight: 600;
              flex-shrink: 0;
              margin-top: 2px;
            ">1</div>
            <div>
              <strong style="color: #1f2937;">Click "Share" in the browser dialog</strong>
              <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">
                When the screen share dialog appears, make sure to click the "Share" button.
              </p>
            </div>
          </div>
          
          <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px;">
            <div style="
              width: 24px;
              height: 24px;
              background: #3b82f6;
              color: white;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              font-weight: 600;
              flex-shrink: 0;
              margin-top: 2px;
            ">2</div>
            <div>
              <strong style="color: #1f2937;">Check "Share audio" checkbox</strong>
              <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">
                Look for a checkbox that says "Share audio" or "Share system audio" and make sure it's checked.
              </p>
            </div>
          </div>
          
          <div style="display: flex; align-items: flex-start; gap: 12px;">
            <div style="
              width: 24px;
              height: 24px;
              background: #3b82f6;
              color: white;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              font-weight: 600;
              flex-shrink: 0;
              margin-top: 2px;
            ">3</div>
            <div>
              <strong style="color: #1f2937;">Select the correct screen/window</strong>
              <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">
                Choose "Entire Screen" or the specific application window you want to share.
              </p>
            </div>
          </div>
        </div>
        
        <div style="
          background: #f3f4f6;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 24px;
          border-left: 4px solid #3b82f6;
        ">
          <p style="color: #374151; font-size: 14px; margin: 0;">
            <strong>💡 Tip:</strong> If you don't see the "Share audio" option, try selecting "Entire Screen" instead of a specific window.
          </p>
        </div>
        
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button id="retry-screen-share" style="
            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
          ">
            Try Again
          </button>
          <button id="continue-without-audio" style="
            background: #6b7280;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
          ">
            Continue Without Audio
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(instructionModal);

    // Add event listeners
    document.getElementById('retry-screen-share').addEventListener('click', () => {
      this.hideInstructions();
      // Trigger screen share again
      setTimeout(() => {
        const screenShareBtn = document.getElementById('menu-btn') || 
                              document.querySelector('.control-btn:has(i.fa-desktop)');
        if (screenShareBtn) {
          screenShareBtn.click();
        }
      }, 500);
    });

    document.getElementById('continue-without-audio').addEventListener('click', () => {
      this.hideInstructions();
    });
  }

  showAudioCaptureInstructions() {
    const modal = document.getElementById('screen-share-audio-instructions');
    if (modal) {
      modal.style.display = 'flex';
      
      // Auto-hide after 30 seconds
      setTimeout(() => {
        this.hideInstructions();
      }, 30000);
    }
  }

  hideInstructions() {
    const modal = document.getElementById('screen-share-audio-instructions');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  showAudioCaptureSuccess(methodName) {
    // Show success notification
    const notification = document.createElement('div');
    notification.className = 'system-audio-status success show';
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <i class="fas fa-check-circle" style="color: #10b981;"></i>
        <span>Computer audio captured successfully!</span>
      </div>
      <div style="font-size: 11px; opacity: 0.8; margin-top: 4px;">
        Method: ${methodName}
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 4000);
  }

  monitorScreenShareEvents() {
    // Monitor for screen share start/stop events
    document.addEventListener('screenshare-started', (event) => {
      console.log('Screen share started event detected');
      this.validateAudioCapture(event.detail?.stream);
    });

    document.addEventListener('screenshare-stopped', (event) => {
      console.log('Screen share stopped event detected');
    });
  }

  validateAudioCapture(stream) {
    if (!stream) return;

    const audioTracks = stream.getAudioTracks();
    const videoTracks = stream.getVideoTracks();

    console.log(`Validating capture: ${videoTracks.length} video, ${audioTracks.length} audio tracks`);

    if (audioTracks.length === 0) {
      console.warn('No audio tracks detected in screen share');
      this.showAudioWarning();
    } else {
      console.log('✅ Audio tracks detected in screen share');
      this.showAudioSuccess();
    }
  }

  showAudioWarning() {
    const warning = document.createElement('div');
    warning.className = 'system-audio-status warning show';
    warning.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <i class="fas fa-exclamation-triangle" style="color: #f59e0b;"></i>
        <span>No computer audio detected</span>
      </div>
      <div style="font-size: 11px; opacity: 0.8; margin-top: 4px;">
        Other participants won't hear your computer audio
      </div>
    `;
    
    document.body.appendChild(warning);
    
    setTimeout(() => {
      warning.classList.remove('show');
      setTimeout(() => {
        if (warning.parentNode) {
          warning.parentNode.removeChild(warning);
        }
      }, 300);
    }, 6000);
  }

  showAudioSuccess() {
    const success = document.createElement('div');
    success.className = 'system-audio-status success show';
    success.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <i class="fas fa-volume-up" style="color: #10b981;"></i>
        <span>Computer audio is being shared</span>
      </div>
      <div style="font-size: 11px; opacity: 0.8; margin-top: 4px;">
        Other participants can hear your computer audio
      </div>
    `;
    
    document.body.appendChild(success);
    
    setTimeout(() => {
      success.classList.remove('show');
      setTimeout(() => {
        if (success.parentNode) {
          success.parentNode.removeChild(success);
        }
      }, 300);
    }, 4000);
  }

  // Method to manually trigger audio capture instructions
  showAudioInstructions() {
    this.showAudioCaptureInstructions();
  }

  // Method to test audio capture capabilities
  async testAudioCapture() {
    console.log('Testing audio capture capabilities...');
    
    for (const method of this.audioCaptureMethods) {
      try {
        console.log(`Testing ${method.name}...`);
        const stream = await this.originalGetDisplayMedia(method.constraints);
        const audioTracks = stream.getAudioTracks();
        
        console.log(`${method.name}: ${audioTracks.length} audio tracks`);
        
        // Stop the test stream
        stream.getTracks().forEach(track => track.stop());
        
        if (audioTracks.length > 0) {
          console.log(`✅ ${method.name} supports audio capture`);
        }
        
      } catch (error) {
        console.log(`❌ ${method.name} test failed:`, error.message);
      }
    }
  }
}

// Initialize the audio fix
const screenShareAudioFix = new ScreenShareAudioFix();

// Make it globally accessible for debugging
window.screenShareAudioFix = screenShareAudioFix;

// Add helper function to show instructions manually
window.showScreenShareAudioHelp = () => {
  screenShareAudioFix.showAudioInstructions();
};

// Add helper function to test audio capture
window.testScreenShareAudio = () => {
  screenShareAudioFix.testAudioCapture();
};

console.log('Screen Share Audio Fix initialized');