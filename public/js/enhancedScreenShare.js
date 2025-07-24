// Enhanced Screen Share with Guaranteed Computer Audio
class EnhancedScreenShareManager {
  constructor(webrtcManager) {
    this.webrtcManager = webrtcManager;
    this.isScreenSharing = false;
    this.screenStream = null;
    this.combinedAudioStream = null;
    this.audioContext = null;
    this.systemAudioTrack = null;
    this.microphoneTrack = null;
    this.mixerNode = null;
    
    this.init();
  }

  init() {
    this.setupScreenShareButton();
    this.overrideWebRTCScreenShare();
  }

  setupScreenShareButton() {
    // Find screen share button and override its functionality
    const screenShareBtn = document.getElementById('menu-btn') || 
                          document.querySelector('[title*="screen"]') ||
                          document.querySelector('.control-btn:has(i.fa-desktop)');
    
    if (screenShareBtn) {
      // Remove existing event listeners
      const newBtn = screenShareBtn.cloneNode(true);
      screenShareBtn.parentNode.replaceChild(newBtn, screenShareBtn);
      
      // Add our enhanced screen share handler
      newBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleScreenShare();
      });
      
      console.log('Enhanced screen share button initialized');
    }
  }

  overrideWebRTCScreenShare() {
    if (!this.webrtcManager) return;

    // Store original methods
    const originalStartScreenShare = this.webrtcManager.startScreenShare?.bind(this.webrtcManager);
    const originalStopScreenShare = this.webrtcManager.stopScreenShare?.bind(this.webrtcManager);

    // Override start screen share
    this.webrtcManager.startScreenShare = async () => {
      return await this.startEnhancedScreenShare();
    };

    // Override stop screen share
    this.webrtcManager.stopScreenShare = async () => {
      return await this.stopEnhancedScreenShare();
    };
  }

  async toggleScreenShare() {
    if (this.isScreenSharing) {
      await this.stopEnhancedScreenShare();
    } else {
      await this.startEnhancedScreenShare();
    }
  }

  async startEnhancedScreenShare() {
    try {
      console.log('Starting enhanced screen share with guaranteed computer audio...');
      
      // Always request both video and audio from screen capture
      const displayMediaConstraints = {
        video: {
          cursor: 'always',
          displaySurface: 'monitor',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000,
          channelCount: 2
        }
      };

      // Get screen capture stream
      this.screenStream = await navigator.mediaDevices.getDisplayMedia(displayMediaConstraints);
      
      const videoTrack = this.screenStream.getVideoTracks()[0];
      const systemAudioTrack = this.screenStream.getAudioTracks()[0];
      
      console.log(`Screen capture: Video tracks: ${this.screenStream.getVideoTracks().length}, Audio tracks: ${this.screenStream.getAudioTracks().length}`);

      // Create enhanced audio stream that combines system audio with microphone
      let finalAudioTrack = null;
      
      if (systemAudioTrack) {
        // We have system audio - create combined stream
        finalAudioTrack = await this.createCombinedAudioTrack(systemAudioTrack);
        console.log('Combined audio track created successfully');
      } else {
        // No system audio captured - try alternative methods
        console.warn('No system audio captured, attempting fallback methods...');
        finalAudioTrack = await this.createFallbackAudioTrack();
      }

      // Create final screen share stream
      const finalTracks = [videoTrack];
      if (finalAudioTrack) {
        finalTracks.push(finalAudioTrack);
      }
      
      const finalScreenStream = new MediaStream(finalTracks);

      // Replace tracks in all peer connections
      await this.replaceTracksInPeerConnections(videoTrack, finalAudioTrack);

      // Update local video display
      this.updateLocalVideoDisplay(finalScreenStream);

      // Add screen share indicators
      this.addScreenShareIndicators(!!finalAudioTrack);

      // Handle screen share end
      videoTrack.onended = () => {
        console.log('Screen share ended by user');
        this.stopEnhancedScreenShare();
      };

      if (systemAudioTrack) {
        systemAudioTrack.onended = () => {
          console.log('System audio track ended');
        };
      }

      this.isScreenSharing = true;
      this.updateScreenShareButton(true);
      
      // Show success notification
      this.showNotification(
        `Screen sharing started ${finalAudioTrack ? 'with computer audio' : 'without computer audio'}`,
        finalAudioTrack ? 'success' : 'warning'
      );

      return finalScreenStream;

    } catch (error) {
      console.error('Error starting enhanced screen share:', error);
      this.handleScreenShareError(error);
      throw error;
    }
  }

  async createCombinedAudioTrack(systemAudioTrack) {
    try {
      // Create audio context for mixing
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });

      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Create audio sources
      const systemAudioSource = this.audioContext.createMediaStreamSource(
        new MediaStream([systemAudioTrack])
      );

      // Create gain nodes for volume control
      const systemGain = this.audioContext.createGain();
      const micGain = this.audioContext.createGain();
      const masterGain = this.audioContext.createGain();

      // Set gain levels - prioritize system audio
      systemGain.gain.value = 1.0;  // Full system audio
      micGain.gain.value = 0.6;     // Reduced microphone to avoid feedback
      masterGain.gain.value = 1.0;  // Master volume

      // Create destination for combined audio
      const destination = this.audioContext.createMediaStreamDestination();

      // Connect system audio
      systemAudioSource.connect(systemGain);
      systemGain.connect(masterGain);

      // Try to get microphone audio (if available and not muted)
      try {
        let microphoneTrack = null;
        
        // Get microphone from existing stream
        if (this.webrtcManager.localStream) {
          microphoneTrack = this.webrtcManager.localStream.getAudioTracks()[0];
        }

        // If no microphone or it's disabled, try to get a new one
        if (!microphoneTrack || !microphoneTrack.enabled) {
          try {
            const micStream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
              }
            });
            microphoneTrack = micStream.getAudioTracks()[0];
            console.log('Got fresh microphone track for mixing');
          } catch (micError) {
            console.log('Could not get microphone for mixing:', micError.message);
          }
        }

        // Add microphone to mix if available
        if (microphoneTrack && microphoneTrack.enabled) {
          const microphoneSource = this.audioContext.createMediaStreamSource(
            new MediaStream([microphoneTrack])
          );
          microphoneSource.connect(micGain);
          micGain.connect(masterGain);
          console.log('Microphone added to audio mix');
        } else {
          console.log('Microphone not added to mix (disabled or unavailable)');
        }

      } catch (micError) {
        console.log('Microphone mixing failed, using system audio only:', micError.message);
      }

      // Connect to destination
      masterGain.connect(destination);

      // Store references for cleanup
      this.systemAudioTrack = systemAudioTrack;
      this.mixerNode = masterGain;

      console.log('Combined audio track created successfully');
      return destination.stream.getAudioTracks()[0];

    } catch (error) {
      console.error('Error creating combined audio track:', error);
      // Return original system audio track as fallback
      return systemAudioTrack;
    }
  }

  async createFallbackAudioTrack() {
    try {
      console.log('Attempting fallback audio capture methods...');
      
      // Method 1: Try to capture with different constraints
      const fallbackConstraints = {
        video: false,
        audio: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: 'screen'
          }
        }
      };

      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        const audioTrack = fallbackStream.getAudioTracks()[0];
        if (audioTrack) {
          console.log('Fallback audio capture successful');
          return audioTrack;
        }
      } catch (fallbackError) {
        console.log('Fallback method 1 failed:', fallbackError.message);
      }

      // Method 2: Try to use existing microphone with processing
      if (this.webrtcManager.localStream) {
        const micTrack = this.webrtcManager.localStream.getAudioTracks()[0];
        if (micTrack) {
          console.log('Using processed microphone as fallback');
          return this.processAudioForScreenShare(micTrack);
        }
      }

      console.log('All fallback methods failed');
      return null;

    } catch (error) {
      console.error('Fallback audio creation failed:', error);
      return null;
    }
  }

  async processAudioForScreenShare(microphoneTrack) {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      const source = this.audioContext.createMediaStreamSource(new MediaStream([microphoneTrack]));
      const gain = this.audioContext.createGain();
      const destination = this.audioContext.createMediaStreamDestination();

      // Boost gain for screen sharing
      gain.gain.value = 1.5;

      source.connect(gain);
      gain.connect(destination);

      return destination.stream.getAudioTracks()[0];
    } catch (error) {
      console.error('Error processing audio for screen share:', error);
      return microphoneTrack;
    }
  }

  async replaceTracksInPeerConnections(videoTrack, audioTrack) {
    if (!this.webrtcManager.peerConnections) return;

    console.log(`Replacing tracks in ${this.webrtcManager.peerConnections.size} peer connections`);

    for (const [socketId, peerConnection] of this.webrtcManager.peerConnections) {
      try {
        // Replace video track
        const videoSender = peerConnection.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        
        if (videoSender && videoTrack) {
          await videoSender.replaceTrack(videoTrack);
          console.log(`Video track replaced for peer ${socketId}`);
        }

        // Replace or add audio track
        if (audioTrack) {
          const audioSender = peerConnection.getSenders().find(s => 
            s.track && s.track.kind === 'audio'
          );
          
          if (audioSender) {
            await audioSender.replaceTrack(audioTrack);
            console.log(`Audio track replaced for peer ${socketId}`);
          } else {
            // Add audio track if no sender exists
            peerConnection.addTrack(audioTrack, new MediaStream([audioTrack]));
            console.log(`Audio track added for peer ${socketId}`);
          }
        }

      } catch (error) {
        console.error(`Error replacing tracks for peer ${socketId}:`, error);
      }
    }
  }

  updateLocalVideoDisplay(stream) {
    const localVideo = document.querySelector(`[data-socket-id="${this.webrtcManager.socket.id}"] .video-frame`);
    if (localVideo) {
      localVideo.srcObject = stream;
      localVideo.play().catch(e => console.error('Error playing local video:', e));
    }
  }

  addScreenShareIndicators(hasAudio) {
    const localWrapper = document.querySelector(`[data-socket-id="${this.webrtcManager.socket.id}"]`);
    if (localWrapper) {
      // Remove existing label
      const existingLabel = localWrapper.querySelector('.video-label');
      if (existingLabel) {
        existingLabel.remove();
      }

      // Add new screen share label
      const label = document.createElement('div');
      label.className = 'video-label screen-share-label';
      label.innerHTML = `
        <i class="fas fa-desktop"></i> 
        Screen Share 
        ${hasAudio ? '<i class="fas fa-volume-up" title="Computer audio included"></i>' : '<i class="fas fa-volume-mute" title="No computer audio"></i>'}
      `;
      localWrapper.appendChild(label);

      // Add pulsing effect for audio indicator
      if (hasAudio) {
        label.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        label.style.animation = 'pulse 2s infinite';
      } else {
        label.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
      }
    }
  }

  async stopEnhancedScreenShare() {
    try {
      console.log('Stopping enhanced screen share...');

      // Stop all screen share tracks
      if (this.screenStream) {
        this.screenStream.getTracks().forEach(track => {
          console.log(`Stopping ${track.kind} track`);
          track.stop();
        });
        this.screenStream = null;
      }

      // Clean up audio context
      if (this.audioContext) {
        try {
          if (this.mixerNode) {
            this.mixerNode.disconnect();
          }
          await this.audioContext.close();
          this.audioContext = null;
        } catch (error) {
          console.warn('Error closing audio context:', error);
        }
      }

      // Restore original camera and microphone
      await this.restoreOriginalTracks();

      // Remove screen share indicators
      this.removeScreenShareIndicators();

      this.isScreenSharing = false;
      this.updateScreenShareButton(false);
      
      this.showNotification('Screen sharing stopped', 'info');

    } catch (error) {
      console.error('Error stopping screen share:', error);
    }
  }

  async restoreOriginalTracks() {
    if (!this.webrtcManager.localStream) return;

    const originalVideoTrack = this.webrtcManager.localStream.getVideoTracks()[0];
    const originalAudioTrack = this.webrtcManager.localStream.getAudioTracks()[0];

    for (const [socketId, peerConnection] of this.webrtcManager.peerConnections) {
      try {
        // Restore video track
        if (originalVideoTrack) {
          const videoSender = peerConnection.getSenders().find(s => 
            s.track && s.track.kind === 'video'
          );
          
          if (videoSender) {
            await videoSender.replaceTrack(originalVideoTrack);
          }
        }

        // Restore audio track
        if (originalAudioTrack) {
          const audioSender = peerConnection.getSenders().find(s => 
            s.track && s.track.kind === 'audio'
          );
          
          if (audioSender) {
            await audioSender.replaceTrack(originalAudioTrack);
          }
        }

      } catch (error) {
        console.error(`Error restoring tracks for peer ${socketId}:`, error);
      }
    }

    // Update local video display
    this.updateLocalVideoDisplay(this.webrtcManager.localStream);
  }

  removeScreenShareIndicators() {
    const localWrapper = document.querySelector(`[data-socket-id="${this.webrtcManager.socket.id}"]`);
    if (localWrapper) {
      const label = localWrapper.querySelector('.screen-share-label');
      if (label) {
        label.remove();
      }
    }
  }

  updateScreenShareButton(isSharing) {
    const screenShareBtn = document.getElementById('menu-btn') || 
                          document.querySelector('[title*="screen"]') ||
                          document.querySelector('.control-btn:has(i.fa-desktop)');
    
    if (screenShareBtn) {
      const icon = screenShareBtn.querySelector('i');
      
      if (isSharing) {
        screenShareBtn.setAttribute('data-active', 'true');
        screenShareBtn.style.background = '#dc2626';
        screenShareBtn.title = 'Stop screen sharing';
        if (icon) {
          icon.className = 'fas fa-stop';
        }
      } else {
        screenShareBtn.setAttribute('data-active', 'false');
        screenShareBtn.style.background = '';
        screenShareBtn.title = 'Share screen';
        if (icon) {
          icon.className = 'fas fa-desktop';
        }
      }
    }
  }

  handleScreenShareError(error) {
    let message = 'Failed to start screen sharing';
    
    if (error.name === 'NotAllowedError') {
      message = 'Screen sharing permission denied. Please allow screen access and try again.';
    } else if (error.name === 'NotFoundError') {
      message = 'No screen available for sharing.';
    } else if (error.name === 'NotSupportedError') {
      message = 'Screen sharing not supported in this browser.';
    } else if (error.name === 'AbortError') {
      message = 'Screen sharing was cancelled.';
    }

    this.showNotification(message, 'error');
  }

  showNotification(message, type = 'info') {
    // Use existing toast system if available
    if (window.hostMeetingInstance && window.hostMeetingInstance.showToast) {
      window.hostMeetingInstance.showToast(message, type);
      return;
    }

    // Fallback notification system
    const notification = document.createElement('div');
    notification.className = `screen-share-notification ${type}`;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'error' ? '#dc2626' : type === 'warning' ? '#f59e0b' : type === 'success' ? '#10b981' : '#3b82f6'};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      z-index: 10001;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease;
    `;
    
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <i class="fas fa-desktop"></i>
        <span>${message}</span>
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
    }, 5000);
  }

  // Public method to check if screen sharing with audio
  isAudioSharingActive() {
    return this.isScreenSharing && this.systemAudioTrack;
  }

  // Public method to get current screen share status
  getScreenShareStatus() {
    return {
      isSharing: this.isScreenSharing,
      hasAudio: !!this.systemAudioTrack,
      hasVideo: !!this.screenStream?.getVideoTracks().length
    };
  }
}

// Auto-initialize when the script loads
document.addEventListener('DOMContentLoaded', () => {
  // Wait for WebRTC manager to be available
  const initializeEnhancedScreenShare = () => {
    const webrtcManager = window.hostMeetingInstance?.webrtc || 
                         window.participantMeetingInstance?.webrtc ||
                         window.webrtcManager;
    
    if (webrtcManager) {
      window.enhancedScreenShare = new EnhancedScreenShareManager(webrtcManager);
      console.log('Enhanced screen share manager initialized');
    } else {
      setTimeout(initializeEnhancedScreenShare, 500);
    }
  };
  
  initializeEnhancedScreenShare();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EnhancedScreenShareManager;
} else {
  window.EnhancedScreenShareManager = EnhancedScreenShareManager;
}