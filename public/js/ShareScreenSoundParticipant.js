class ShareScreenSound {
  constructor(webrtcManager) {
    this.webrtcManager = webrtcManager;
    this.shareComputerSound = false;
    this.soundToggle = null;
    this.init();
  }

  init() {
    // Find and setup the computer sound toggle
    this.setupSoundToggle();
    
    // Override the original screen share methods
    this.overrideScreenShareMethods();
  }

  setupSoundToggle() {
    // Find the computer sound toggle checkbox
    const settingItems = document.querySelectorAll('.setting-item');
    
    settingItems.forEach(item => {
      const span = item.querySelector('span');
      if (span && span.textContent.trim() === 'Share computer sound') {
        this.soundToggle = item.querySelector('input[type="checkbox"]');
        if (this.soundToggle) {
          this.soundToggle.addEventListener('change', (e) => {
            this.shareComputerSound = e.target.checked;
            console.log('Computer sound sharing:', this.shareComputerSound ? 'enabled' : 'disabled');
            
            // If screen is currently being shared, restart with new audio settings
            if (this.webrtcManager.isScreenSharing) {
              this.restartScreenShareWithAudio();
            }
          });
        }
      }
    });

    if (!this.soundToggle) {
      console.warn('Computer sound toggle not found');
    }
  }

  overrideScreenShareMethods() {
    // Store original methods
    const originalStartScreenShare = this.webrtcManager.startScreenShare.bind(this.webrtcManager);
    const originalStopScreenShare = this.webrtcManager.stopScreenShare.bind(this.webrtcManager);

    // Override startScreenShare method
    this.webrtcManager.startScreenShare = async () => {
      try {
        // Get display media with conditional audio
        const constraints = {
          video: { 
            cursor: 'always',
            displaySurface: 'monitor' // Prefer monitor capture for better audio support
          },
          audio: this.shareComputerSound // Include audio based on toggle state
        };

        console.log('Starting screen share with constraints:', constraints);
        
        this.webrtcManager.screenStream = await navigator.mediaDevices.getDisplayMedia(constraints);

        // Check if audio track was actually captured
        const audioTracks = this.webrtcManager.screenStream.getAudioTracks();
        const videoTracks = this.webrtcManager.screenStream.getVideoTracks();
        
        console.log(`Screen share started - Video tracks: ${videoTracks.length}, Audio tracks: ${audioTracks.length}`);

        if (this.shareComputerSound && audioTracks.length === 0) {
          console.warn('Computer sound was requested but no audio track was captured');
          this.showAudioWarning();
        }

        // Replace video track in all peer connections
        const videoTrack = videoTracks[0];
        
        for (const [socketId, peerConnection] of this.webrtcManager.peerConnections) {
          const videoSender = peerConnection.getSenders().find(s => 
            s.track && s.track.kind === 'video'
          );
          
          if (videoSender) {
            await videoSender.replaceTrack(videoTrack);
          }

          // Handle audio track replacement/addition for computer sound
          if (this.shareComputerSound && audioTracks.length > 0) {
            await this.handleScreenAudioTrack(peerConnection, audioTracks[0]);
          }
        }

        // Update local video to show screen share
        const localVideo = document.querySelector(`[data-socket-id="${this.webrtcManager.socket.id}"] .video-frame`);
        if (localVideo) {
          localVideo.srcObject = this.webrtcManager.screenStream;
        }

        // Add screen share label with audio indicator
        this.updateScreenShareLabel();

        // Handle screen share end
        videoTrack.onended = () => {
          this.webrtcManager.stopScreenShare();
        };

        // Handle audio track end (user might stop sharing audio separately)
        if (audioTracks.length > 0) {
          audioTracks[0].onended = () => {
            console.log('Screen audio track ended');
            this.updateScreenShareLabel(); // Update label to remove audio indicator
          };
        }

        this.webrtcManager.isScreenSharing = true;
        
      } catch (error) {
        console.error('Error starting screen share:', error);
        
        // Provide specific error messages
        if (error.name === 'NotAllowedError') {
          throw new Error('Screen sharing permission denied');
        } else if (error.name === 'NotFoundError') {
          throw new Error('No screen available for sharing');
        } else if (error.name === 'NotSupportedError') {
          throw new Error('Screen sharing not supported in this browser');
        } else {
          throw error;
        }
      }
    };

    // Keep the original stopScreenShare method but enhance it
    this.webrtcManager.stopScreenShare = async () => {
      if (this.webrtcManager.screenStream) {
        // Stop all tracks (both video and audio)
        this.webrtcManager.screenStream.getTracks().forEach(track => {
          console.log(`Stopping ${track.kind} track`);
          track.stop();
        });
        this.webrtcManager.screenStream = null;
      }

      // Replace back to camera video and original audio
      if (this.webrtcManager.localStream) {
        const videoTrack = this.webrtcManager.localStream.getVideoTracks()[0];
        const audioTrack = this.webrtcManager.localStream.getAudioTracks()[0];
        
        for (const [socketId, peerConnection] of this.webrtcManager.peerConnections) {
          // Replace video track
          const videoSender = peerConnection.getSenders().find(s => 
            s.track && s.track.kind === 'video'
          );
          
          if (videoSender && videoTrack) {
            await videoSender.replaceTrack(videoTrack);
          }

          // Replace audio track back to microphone
          const audioSender = peerConnection.getSenders().find(s => 
            s.track && s.track.kind === 'audio'
          );
          
          if (audioSender && audioTrack) {
            await audioSender.replaceTrack(audioTrack);
          }
        }

        // Update local video back to camera
        const localVideo = document.querySelector(`[data-socket-id="${this.webrtcManager.socket.id}"] .video-frame`);
        if (localVideo) {
          localVideo.srcObject = this.webrtcManager.localStream;
        }

        // Remove screen share label
        const localWrapper = document.querySelector(`[data-socket-id="${this.webrtcManager.socket.id}"]`);
        if (localWrapper) {
          const label = localWrapper.querySelector('.video-label');
          if (label) {
            label.remove();
          }
        }
      }

      this.webrtcManager.isScreenSharing = false;
    };
  }

  async handleScreenAudioTrack(peerConnection, audioTrack) {
    try {
      // Check if there's already an audio sender
      const audioSender = peerConnection.getSenders().find(s => 
        s.track && s.track.kind === 'audio'
      );

      if (audioSender) {
        // Create a mixed audio track combining microphone and screen audio
        const mixedTrack = await this.createMixedAudioTrack(audioTrack);
        if (mixedTrack) {
          await audioSender.replaceTrack(mixedTrack);
        }
      } else {
        // Add the screen audio track directly
        peerConnection.addTrack(audioTrack, this.webrtcManager.screenStream);
      }
    } catch (error) {
      console.error('Error handling screen audio track:', error);
    }
  }

  async createCombinedAudioStream(systemAudioTrack) {
    try {
      if (!this.webrtcManager.audioContext) {
        this.webrtcManager.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      // Resume audio context if suspended
      if (this.webrtcManager.audioContext.state === 'suspended') {
        await this.webrtcManager.audioContext.resume();
      }

      // Use the WebRTC manager's audio context
      const audioContext = this.webrtcManager.audioContext;

      // Create audio sources
      const systemAudioSource = audioContext.createMediaStreamSource(
        new MediaStream([systemAudioTrack])
      );
      
      let microphoneSource = null;
      if (this.webrtcManager.originalMicrophoneTrack && this.webrtcManager.originalMicrophoneTrack.enabled) {
        microphoneSource = audioContext.createMediaStreamSource(
          new MediaStream([this.webrtcManager.originalMicrophoneTrack])
        );
      } else if (this.webrtcManager.localStream) {
        const micTrack = this.webrtcManager.localStream.getAudioTracks()[0];
        if (micTrack && micTrack.enabled) {
          microphoneSource = audioContext.createMediaStreamSource(
            new MediaStream([micTrack])
          );
        }
      }

      // Create gain nodes for volume control
      const systemGain = audioContext.createGain();
      const micGain = audioContext.createGain();
      const outputGain = audioContext.createGain();

      // Set gain levels
      systemGain.gain.value = 1.0; // Full system audio
      micGain.gain.value = 0.7;    // Slightly reduced microphone
      outputGain.gain.value = 1.0;

      // Create destination for combined audio
      const destination = audioContext.createMediaStreamDestination();

      // Connect audio graph
      systemAudioSource.connect(systemGain);
      systemGain.connect(outputGain);

      if (microphoneSource) {
        microphoneSource.connect(micGain);
        micGain.connect(outputGain);
      }

      outputGain.connect(destination);

      console.log('Combined audio stream created successfully');
      return destination.stream;

    } catch (error) {
      console.error('Error creating combined audio stream:', error);
      return null;
    }
  }

  async restartScreenShareWithAudio() {
    if (!this.webrtcManager.isScreenSharing) return;

    try {
      // Stop current screen share
      await this.webrtcManager.stopScreenShare();
      
      // Small delay to ensure cleanup
      setTimeout(async () => {
        // Start screen share again with new audio settings
        await this.webrtcManager.startScreenShare();
      }, 100);
    } catch (error) {
      console.error('Error restarting screen share:', error);
    }
  }

  updateScreenShareLabel() {
    const localWrapper = document.querySelector(`[data-socket-id="${this.webrtcManager.socket.id}"]`);
    if (localWrapper) {
      let label = localWrapper.querySelector('.video-label');
      if (!label) {
        label = document.createElement('div');
        label.className = 'video-label';
        localWrapper.appendChild(label);
      }

      const hasAudio = this.webrtcManager.screenStream && 
                      this.webrtcManager.screenStream.getAudioTracks().length > 0;
      
      const audioIcon = hasAudio ? '<i class="fas fa-volume-up"></i>' : '';
      label.innerHTML = `<i class="fas fa-desktop"></i> Screen Share ${audioIcon}`;
    }
  }

  showAudioWarning() {
    // Create a toast notification about audio not being available
    const toast = document.createElement('div');
    toast.className = 'toast info';
    toast.innerHTML = `
      <i class="fas fa-info-circle"></i>
      Computer audio not available. Make sure to select "Share audio" in the screen share dialog.
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 5000); // Show for 5 seconds for audio warning
  }

  // Public method to get current audio sharing state
  isAudioSharingEnabled() {
    return this.shareComputerSound;
  }

  // Public method to toggle audio sharing programmatically
  toggleAudioSharing() {
    if (this.soundToggle) {
      this.soundToggle.checked = !this.soundToggle.checked;
      this.shareComputerSound = this.soundToggle.checked;
      
      if (this.webrtcManager.isScreenSharing) {
        this.restartScreenShareWithAudio();
      }
    }
  }
}

// Auto-initialize when the script loads
document.addEventListener('DOMContentLoaded', () => {
  // Wait for the meeting instance to be initialized (works for both host and participant)
  const initializeScreenSound = () => {
    // Check for both host and participant meeting instances
    const meetingInstance = window.hostMeetingInstance || window.participantMeetingInstance;
    
    if (meetingInstance && meetingInstance.webrtc) {
      window.shareScreenSound = new ShareScreenSound(meetingInstance.webrtc);
      console.log('ShareScreenSound initialized for', window.hostMeetingInstance ? 'host' : 'participant');
    } else {
      // Retry after a short delay
      setTimeout(initializeScreenSound, 500);
    }
  };
  
  initializeScreenSound();
});