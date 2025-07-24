class AudioDeviceManager {
  constructor() {
    this.audioDevices = [];
    this.selectedDeviceId = null;
    this.currentStream = null;
    this.microphoneSelect = null;
    
    this.init();
  }

  async init() {
    // Find the microphone dropdown in the settings
    this.microphoneSelect = document.querySelector('#audio .setting-item select.dropdown');
    
    if (!this.microphoneSelect) {
      console.error('Microphone dropdown not found');
      return;
    }

    // Request permission to access media devices
    await this.requestPermissions();
    
    // Load available devices
    await this.loadAudioDevices();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Monitor device changes
    this.monitorDeviceChanges();
  }

  async requestPermissions() {
    try {
      // Request microphone permission to enumerate devices
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      console.warn('Could not get microphone permission:', error);
    }
  }

  async loadAudioDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.audioDevices = devices.filter(device => device.kind === 'audioinput');
      
      this.populateDeviceDropdown();
    } catch (error) {
      console.error('Error loading audio devices:', error);
    }
  }

  populateDeviceDropdown() {
    if (!this.microphoneSelect) return;

    // Clear existing options
    this.microphoneSelect.innerHTML = '';

    if (this.audioDevices.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No microphones found';
      option.disabled = true;
      this.microphoneSelect.appendChild(option);
      return;
    }

    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = 'default';
    defaultOption.textContent = 'Default Microphone';
    this.microphoneSelect.appendChild(defaultOption);

    // Add each available device
    this.audioDevices.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      
      // Use device label if available, otherwise create a generic name
      if (device.label) {
        option.textContent = device.label;
      } else {
        option.textContent = `Microphone ${index + 1}`;
      }
      
      this.microphoneSelect.appendChild(option);
    });

    // Set the currently selected device
    if (this.selectedDeviceId) {
      this.microphoneSelect.value = this.selectedDeviceId;
    }
  }

  setupEventListeners() {
    if (!this.microphoneSelect) return;

    this.microphoneSelect.addEventListener('change', async (event) => {
      const selectedDeviceId = event.target.value;
      await this.selectDevice(selectedDeviceId);
    });
  }

  async selectDevice(deviceId) {
    try {
      this.selectedDeviceId = deviceId === 'default' ? null : deviceId;
      
      // Update the WebRTC manager with the new device
      if (window.hostMeetingInstance && window.hostMeetingInstance.webrtc) {
        await this.updateWebRTCDevice(deviceId);
      }
      
      // Store the selection in localStorage for persistence
      localStorage.setItem('selectedMicrophoneId', deviceId);
      
      console.log('Selected microphone device:', deviceId);
      
      // Show success message
      this.showDeviceChangeNotification();
      
    } catch (error) {
      console.error('Error selecting microphone device:', error);
      this.showErrorNotification('Failed to switch microphone device');
    }
  }

  async updateWebRTCDevice(deviceId) {
    const webrtc = window.hostMeetingInstance.webrtc;
    
    // Stop current stream
    if (webrtc.localStream) {
      webrtc.localStream.getAudioTracks().forEach(track => track.stop());
    }

    // Create constraints for the new device
    const constraints = {
      video: { 
        width: { ideal: 1280 }, 
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      },
      audio: {
        deviceId: deviceId === 'default' ? undefined : { exact: deviceId },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    };

    // Get new stream with selected device
    const newStream = await navigator.mediaDevices.getUserMedia(constraints);
    
    // Update the local stream
    webrtc.localStream = newStream;
    
    // Update all peer connections with the new audio track
    const audioTrack = newStream.getAudioTracks()[0];
    
    for (const [socketId, peerConnection] of webrtc.peerConnections) {
      const sender = peerConnection.getSenders().find(s => 
        s.track && s.track.kind === 'audio'
      );
      
      if (sender) {
        await sender.replaceTrack(audioTrack);
      }
    }

    // Update local video element
    const localVideo = document.querySelector(`[data-socket-id="${webrtc.socket.id}"] .video-frame`);
    if (localVideo) {
      localVideo.srcObject = newStream;
    }

    // Restart audio level monitoring with new stream
    webrtc.startAudioLevelMonitoring();
  }

  monitorDeviceChanges() {
    // Listen for device changes (when devices are plugged/unplugged)
    navigator.mediaDevices.addEventListener('devicechange', async () => {
      console.log('Audio devices changed, reloading...');
      await this.loadAudioDevices();
    });
  }

  showDeviceChangeNotification() {
    if (window.hostMeetingInstance && window.hostMeetingInstance.showToast) {
      window.hostMeetingInstance.showToast('Microphone device changed successfully', 'success');
    }
  }

  showErrorNotification(message) {
    if (window.hostMeetingInstance && window.hostMeetingInstance.showToast) {
      window.hostMeetingInstance.showToast(message, 'error');
    }
  }

  // Method to get the currently selected device
  getSelectedDevice() {
    return this.selectedDeviceId;
  }

  // Method to test the selected microphone
  async testMicrophone() {
    try {
      const constraints = {
        audio: {
          deviceId: this.selectedDeviceId ? { exact: this.selectedDeviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      const testStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Create audio context for testing
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(testStream);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      microphone.connect(analyser);
      analyser.fftSize = 256;

      // Test for 3 seconds
      let testDuration = 3000;
      const testInterval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const normalizedLevel = average / 255;
        
        // Update audio meter if it exists
        const audioMeter = document.querySelector('.audio-meter .meter-bar');
        if (audioMeter) {
          audioMeter.style.width = `${normalizedLevel * 100}%`;
        }
        
        testDuration -= 100;
        if (testDuration <= 0) {
          clearInterval(testInterval);
          testStream.getTracks().forEach(track => track.stop());
          audioContext.close();
          
          if (audioMeter) {
            audioMeter.style.width = '0%';
          }
        }
      }, 100);

      this.showDeviceChangeNotification();
      
    } catch (error) {
      console.error('Error testing microphone:', error);
      this.showErrorNotification('Failed to test microphone');
    }
  }

  // Load saved device preference
  loadSavedDevice() {
    const savedDeviceId = localStorage.getItem('selectedMicrophoneId');
    if (savedDeviceId && this.microphoneSelect) {
      this.microphoneSelect.value = savedDeviceId;
      this.selectedDeviceId = savedDeviceId === 'default' ? null : savedDeviceId;
    }
  }
}

// Initialize the audio device manager when the page loads
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit for the settings modal to be ready
  setTimeout(() => {
    window.audioDeviceManager = new AudioDeviceManager();
  }, 1000);
});

// Export for use in other modules
window.AudioDeviceManager = AudioDeviceManager;