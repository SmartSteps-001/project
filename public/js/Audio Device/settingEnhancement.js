// Enhancement for the settings modal to integrate with audio device manager
document.addEventListener('DOMContentLoaded', () => {
  // Wait for settings modal to be available
  setTimeout(() => {
    setupAudioSettings();
  }, 1500);
});

function setupAudioSettings() {
  // Add test microphone button functionality
  const testMicButton = document.querySelector('.audio-test .test-btn');
  if (testMicButton) {
    testMicButton.addEventListener('click', async () => {
      if (window.audioDeviceManager) {
        testMicButton.textContent = 'Testing...';
        testMicButton.disabled = true;
        
        await window.audioDeviceManager.testMicrophone();
        
        setTimeout(() => {
          testMicButton.textContent = 'Test Microphone';
          testMicButton.disabled = false;
        }, 3000);
      }
    });
  }

  // Load saved device preference when settings open
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      setTimeout(() => {
        if (window.audioDeviceManager) {
          window.audioDeviceManager.loadSavedDevice();
        }
      }, 100);
    });
  }

  // Also handle the settings button in the tools panel
  const settingsToolBtn = document.querySelector('.quantum-tool-item-2x9v[onclick*="settings"]');
  if (settingsToolBtn) {
    settingsToolBtn.addEventListener('click', () => {
      setTimeout(() => {
        if (window.audioDeviceManager) {
          window.audioDeviceManager.loadSavedDevice();
        }
      }, 100);
    });
  }
}

// Enhance the WebRTC initialization to use selected device
if (window.WebRTCManager) {
  const originalInitialize = window.WebRTCManager.prototype.initialize;
  
  window.WebRTCManager.prototype.initialize = async function() {
    try {
      // Get saved device preference
      const savedDeviceId = localStorage.getItem('selectedMicrophoneId');
      const deviceId = savedDeviceId && savedDeviceId !== 'default' ? savedDeviceId : undefined;
      
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: { 
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      // Start audio level monitoring
      this.startAudioLevelMonitoring();
      
      console.log('Local stream initialized with device:', deviceId || 'default');
      return true;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      // Fallback to default device if specific device fails
      if (deviceId) {
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({
            video: { 
              width: { ideal: 1280 }, 
              height: { ideal: 720 },
              frameRate: { ideal: 30 }
            },
            audio: { 
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
          
          this.startAudioLevelMonitoring();
          console.log('Fallback to default audio device successful');
          return true;
        } catch (fallbackError) {
          console.error('Fallback also failed:', fallbackError);
          return false;
        }
      }
      return false;
    }
  };
}