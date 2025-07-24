class CameraDeviceManager {
  constructor() {
    this.availableDevices = [];
    this.currentDeviceId = null;
    this.videoElement = null;
    this.currentStream = null;
    this.webrtcManager = null;
    
    this.init();
  }

  async init() {
    // Wait for the page to load and WebRTC manager to be available
    if (typeof window !== 'undefined') {
      window.addEventListener('load', () => {
        setTimeout(() => {
          this.webrtcManager = window.hostMeetingInstance?.webrtc;
          this.setupCameraSelector();
          this.loadAvailableDevices();
        }, 2000);
      });
    }
  }

  setupCameraSelector() {
    const cameraSelect = document.querySelector('#video .setting-item select.dropdown');
    if (cameraSelect) {
      // Clear existing options
      cameraSelect.innerHTML = '<option>Loading cameras...</option>';
      
      // Add event listener for camera selection
      cameraSelect.addEventListener('change', (event) => {
        const selectedDeviceId = event.target.value;
        if (selectedDeviceId && selectedDeviceId !== 'loading') {
          this.switchCamera(selectedDeviceId);
        }
      });
    }
  }

  async loadAvailableDevices() {
    try {
      // Request permission first to get device labels
      await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      
      // Get all video input devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.availableDevices = devices.filter(device => device.kind === 'videoinput');
      
      this.populateCameraDropdown();
      
      // Set the current device as the first available one if none is set
      if (this.availableDevices.length > 0 && !this.currentDeviceId) {
        this.currentDeviceId = this.availableDevices[0].deviceId;
      }
      
    } catch (error) {
      console.error('Error loading camera devices:', error);
      this.showCameraError('Unable to access camera devices');
    }
  }

  populateCameraDropdown() {
    const cameraSelect = document.querySelector('#video .setting-item select.dropdown');
    if (!cameraSelect) return;

    // Clear loading message
    cameraSelect.innerHTML = '';

    if (this.availableDevices.length === 0) {
      cameraSelect.innerHTML = '<option>No cameras found</option>';
      return;
    }

    // Add available cameras to dropdown
    this.availableDevices.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      
      // Create a user-friendly name
      let deviceName = device.label || `Camera ${index + 1}`;
      
      // Clean up the device name
      if (deviceName.includes('(')) {
        deviceName = deviceName.split('(')[0].trim();
      }
      
      // Add common camera type indicators
      if (deviceName.toLowerCase().includes('front') || deviceName.toLowerCase().includes('user')) {
        deviceName += ' (Front)';
      } else if (deviceName.toLowerCase().includes('back') || deviceName.toLowerCase().includes('environment')) {
        deviceName += ' (Back)';
      } else if (deviceName.toLowerCase().includes('usb') || deviceName.toLowerCase().includes('external')) {
        deviceName += ' (External)';
      }
      
      option.textContent = deviceName;
      
      // Mark as selected if it's the current device
      if (device.deviceId === this.currentDeviceId) {
        option.selected = true;
      }
      
      cameraSelect.appendChild(option);
    });

    // Add refresh option
   
    // Handle refresh selection
    cameraSelect.addEventListener('change', (event) => {
      if (event.target.value === 'refresh') {
        this.loadAvailableDevices();
        event.target.value = this.currentDeviceId || '';
      }
    });
  }

  async switchCamera(deviceId) {
    try {
      console.log('Switching to camera:', deviceId);
      
      // Stop current stream if exists
      if (this.currentStream) {
        this.currentStream.getTracks().forEach(track => track.stop());
      }

      // Get new stream with selected camera
      const constraints = {
        video: { 
          deviceId: { exact: deviceId },
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: false // We'll keep the existing audio stream
      };

      const newVideoStream = await navigator.mediaDevices.getUserMedia(constraints);
      const videoTrack = newVideoStream.getVideoTracks()[0];

      // Update WebRTC manager's local stream
      if (this.webrtcManager && this.webrtcManager.localStream) {
        // Replace video track in local stream
        const oldVideoTrack = this.webrtcManager.localStream.getVideoTracks()[0];
        if (oldVideoTrack) {
          this.webrtcManager.localStream.removeTrack(oldVideoTrack);
          oldVideoTrack.stop();
        }
        
        this.webrtcManager.localStream.addTrack(videoTrack);

        // Update all peer connections with new video track
        for (const [socketId, peerConnection] of this.webrtcManager.peerConnections) {
          const sender = peerConnection.getSenders().find(s => 
            s.track && s.track.kind === 'video'
          );
          
          if (sender) {
            await sender.replaceTrack(videoTrack);
          }
        }

        // Update local video display
        this.updateLocalVideoDisplay();
      }

      this.currentDeviceId = deviceId;
      this.currentStream = newVideoStream;
      
      this.showCameraSuccess('Camera switched successfully');
      
    } catch (error) {
      console.error('Error switching camera:', error);
      this.showCameraError('Failed to switch camera: ' + error.message);
    }
  }

  updateLocalVideoDisplay() {
    // Update the local video element in the meeting
    setTimeout(() => {
      const localVideo = document.querySelector(`[data-socket-id="${this.webrtcManager.socket.id}"] .video-frame`);
      if (localVideo && this.webrtcManager.localStream) {
        localVideo.srcObject = this.webrtcManager.localStream;
        localVideo.play().catch(e => console.error('Error playing updated video:', e));
      }
    }, 100);
  }

  showCameraSuccess(message) {
    this.showToast(message, 'success');
  }

  showCameraError(message) {
    this.showToast(message, 'error');
  }

  showToast(message, type = 'info') {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = `camera-toast ${type}`;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-size: 14px;
      max-width: 300px;
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease;
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 3 seconds
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

  // Method to refresh device list (can be called externally)
  async refreshDevices() {
    await this.loadAvailableDevices();
  }

  // Method to get current camera info
  getCurrentCameraInfo() {
    if (!this.currentDeviceId) return null;
    
    return this.availableDevices.find(device => device.deviceId === this.currentDeviceId);
  }

  // Method to test camera (for settings preview)
  async testCamera(deviceId = null) {
    const testDeviceId = deviceId || this.currentDeviceId;
    if (!testDeviceId) return;

    try {
      const testStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: testDeviceId } }
      });

      // Show in video preview if available
      const videoPreview = document.querySelector('.video-monitor');
      if (videoPreview) {
        let video = videoPreview.querySelector('video');
        if (!video) {
          video = document.createElement('video');
          video.autoplay = true;
          video.muted = true;
          video.style.width = '100%';
          video.style.height = '100%';
          video.style.objectFit = 'cover';
          videoPreview.innerHTML = '';
          videoPreview.appendChild(video);
        }
        video.srcObject = testStream;
      }

      // Stop test stream after 5 seconds
      setTimeout(() => {
        testStream.getTracks().forEach(track => track.stop());
      }, 5000);

    } catch (error) {
      console.error('Error testing camera:', error);
      this.showCameraError('Failed to test camera');
    }
  }
}

// Initialize camera device manager
const cameraDeviceManager = new CameraDeviceManager();

// Make it globally accessible
window.cameraDeviceManager = cameraDeviceManager;

// Add test video button functionality
document.addEventListener('DOMContentLoaded', () => {
  const testVideoBtn = document.querySelector('#video .test-btn-mic');
  if (testVideoBtn) {
    testVideoBtn.addEventListener('click', () => {
      cameraDeviceManager.testCamera();
    });
  }
});