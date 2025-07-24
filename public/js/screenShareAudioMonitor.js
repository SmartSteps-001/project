// Screen Share Audio Monitor - Real-time monitoring and feedback
class ScreenShareAudioMonitor {
  constructor() {
    this.isMonitoring = false;
    this.audioLevelThreshold = 0.01;
    this.monitoringInterval = null;
    this.lastAudioActivity = 0;
    this.audioIndicators = new Map();
    
    this.init();
  }

  init() {
    this.createAudioIndicators();
    this.setupMonitoring();
  }

  createAudioIndicators() {
    // Create floating audio level indicator
    const audioIndicator = document.createElement('div');
    audioIndicator.id = 'screen-share-audio-indicator';
    audioIndicator.style.cssText = `
      position: fixed;
      bottom: 140px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 16px;
      border-radius: 12px;
      z-index: 1000;
      display: none;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      min-width: 200px;
    `;

    audioIndicator.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <i class="fas fa-desktop" style="color: #3b82f6;"></i>
        <span style="font-weight: 600; font-size: 12px;">Screen Share Audio</span>
      </div>
      
      <div style="margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="font-size: 11px; opacity: 0.8;">System Audio</span>
          <span id="system-audio-level" style="font-size: 11px; font-weight: 600;">0%</span>
        </div>
        <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; overflow: hidden;">
          <div id="system-audio-bar" style="height: 100%; background: linear-gradient(90deg, #10b981, #3b82f6); width: 0%; transition: width 0.1s ease;"></div>
        </div>
      </div>
      
      <div style="margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="font-size: 11px; opacity: 0.8;">Microphone</span>
          <span id="mic-audio-level" style="font-size: 11px; font-weight: 600;">0%</span>
        </div>
        <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; overflow: hidden;">
          <div id="mic-audio-bar" style="height: 100%; background: linear-gradient(90deg, #f59e0b, #dc2626); width: 0%; transition: width 0.1s ease;"></div>
        </div>
      </div>
      
      <div style="display: flex; align-items: center; gap: 8px; font-size: 11px;">
        <div id="audio-status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #dc2626;"></div>
        <span id="audio-status-text">No audio detected</span>
      </div>
    `;

    document.body.appendChild(audioIndicator);
  }

  setupMonitoring() {
    // Monitor screen share events
    document.addEventListener('screenshare-started', (event) => {
      this.startMonitoring(event.detail?.stream);
    });

    document.addEventListener('screenshare-stopped', () => {
      this.stopMonitoring();
    });

    // Also hook into enhanced screen share manager
    const checkForScreenShare = () => {
      if (window.enhancedScreenShare) {
        const originalStart = window.enhancedScreenShare.startEnhancedScreenShare.bind(window.enhancedScreenShare);
        const originalStop = window.enhancedScreenShare.stopEnhancedScreenShare.bind(window.enhancedScreenShare);

        window.enhancedScreenShare.startEnhancedScreenShare = async () => {
          const result = await originalStart();
          this.startMonitoring(result);
          return result;
        };

        window.enhancedScreenShare.stopEnhancedScreenShare = async () => {
          const result = await originalStop();
          this.stopMonitoring();
          return result;
        };
      } else {
        setTimeout(checkForScreenShare, 500);
      }
    };

    checkForScreenShare();
  }

  startMonitoring(stream) {
    if (!stream) return;

    console.log('Starting screen share audio monitoring...');
    this.isMonitoring = true;

    // Show audio indicator
    const indicator = document.getElementById('screen-share-audio-indicator');
    if (indicator) {
      indicator.style.display = 'block';
    }

    // Set up audio analysis
    this.setupAudioAnalysis(stream);

    // Start periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.updateAudioStatus();
    }, 100);
  }

  stopMonitoring() {
    console.log('Stopping screen share audio monitoring...');
    this.isMonitoring = false;

    // Hide audio indicator
    const indicator = document.getElementById('screen-share-audio-indicator');
    if (indicator) {
      indicator.style.display = 'none';
    }

    // Clear monitoring interval
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Clean up audio analysis
    this.cleanupAudioAnalysis();
  }

  setupAudioAnalysis(stream) {
    try {
      const audioTracks = stream.getAudioTracks();
      
      if (audioTracks.length === 0) {
        console.warn('No audio tracks found in stream');
        return;
      }

      // Create audio context for analysis
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Create analyser for system audio
      this.systemAnalyser = this.audioContext.createAnalyser();
      this.systemAnalyser.fftSize = 256;
      this.systemAnalyser.smoothingTimeConstant = 0.8;

      // Connect system audio track
      const systemAudioSource = this.audioContext.createMediaStreamSource(
        new MediaStream([audioTracks[0]])
      );
      systemAudioSource.connect(this.systemAnalyser);

      // Set up microphone analysis if available
      if (window.hostMeetingInstance?.webrtc?.localStream) {
        const micTrack = window.hostMeetingInstance.webrtc.localStream.getAudioTracks()[0];
        if (micTrack) {
          this.micAnalyser = this.audioContext.createAnalyser();
          this.micAnalyser.fftSize = 256;
          this.micAnalyser.smoothingTimeConstant = 0.8;

          const micSource = this.audioContext.createMediaStreamSource(
            new MediaStream([micTrack])
          );
          micSource.connect(this.micAnalyser);
        }
      }

      console.log('Audio analysis setup complete');

    } catch (error) {
      console.error('Error setting up audio analysis:', error);
    }
  }

  updateAudioStatus() {
    if (!this.isMonitoring || !this.systemAnalyser) return;

    try {
      // Analyze system audio
      const systemDataArray = new Uint8Array(this.systemAnalyser.frequencyBinCount);
      this.systemAnalyser.getByteFrequencyData(systemDataArray);

      let systemLevel = 0;
      for (let i = 0; i < systemDataArray.length; i++) {
        systemLevel += systemDataArray[i];
      }
      systemLevel = (systemLevel / systemDataArray.length) / 255;

      // Analyze microphone audio
      let micLevel = 0;
      if (this.micAnalyser) {
        const micDataArray = new Uint8Array(this.micAnalyser.frequencyBinCount);
        this.micAnalyser.getByteFrequencyData(micDataArray);

        for (let i = 0; i < micDataArray.length; i++) {
          micLevel += micDataArray[i];
        }
        micLevel = (micLevel / micDataArray.length) / 255;
      }

      // Update UI indicators
      this.updateAudioIndicators(systemLevel, micLevel);

      // Check for audio activity
      if (systemLevel > this.audioLevelThreshold || micLevel > this.audioLevelThreshold) {
        this.lastAudioActivity = Date.now();
      }

    } catch (error) {
      console.error('Error updating audio status:', error);
    }
  }

  updateAudioIndicators(systemLevel, micLevel) {
    // Update system audio level
    const systemLevelText = document.getElementById('system-audio-level');
    const systemBar = document.getElementById('system-audio-bar');
    
    if (systemLevelText && systemBar) {
      const systemPercent = Math.round(systemLevel * 100);
      systemLevelText.textContent = `${systemPercent}%`;
      systemBar.style.width = `${systemPercent}%`;
    }

    // Update microphone level
    const micLevelText = document.getElementById('mic-audio-level');
    const micBar = document.getElementById('mic-audio-bar');
    
    if (micLevelText && micBar) {
      const micPercent = Math.round(micLevel * 100);
      micLevelText.textContent = `${micPercent}%`;
      micBar.style.width = `${micPercent}%`;
    }

    // Update status
    const statusDot = document.getElementById('audio-status-dot');
    const statusText = document.getElementById('audio-status-text');
    
    if (statusDot && statusText) {
      const hasRecentActivity = (Date.now() - this.lastAudioActivity) < 2000;
      
      if (systemLevel > this.audioLevelThreshold) {
        statusDot.style.background = '#10b981';
        statusText.textContent = 'System audio active';
      } else if (micLevel > this.audioLevelThreshold) {
        statusDot.style.background = '#f59e0b';
        statusText.textContent = 'Microphone active';
      } else if (hasRecentActivity) {
        statusDot.style.background = '#3b82f6';
        statusText.textContent = 'Audio detected recently';
      } else {
        statusDot.style.background = '#dc2626';
        statusText.textContent = 'No audio detected';
      }
    }
  }

  cleanupAudioAnalysis() {
    if (this.audioContext) {
      try {
        this.audioContext.close();
        this.audioContext = null;
      } catch (error) {
        console.warn('Error closing audio context:', error);
      }
    }

    this.systemAnalyser = null;
    this.micAnalyser = null;
  }

  // Public method to get current audio levels
  getCurrentAudioLevels() {
    if (!this.isMonitoring) return null;

    return {
      systemAudio: this.getAudioLevel(this.systemAnalyser),
      microphone: this.getAudioLevel(this.micAnalyser),
      hasRecentActivity: (Date.now() - this.lastAudioActivity) < 2000
    };
  }

  getAudioLevel(analyser) {
    if (!analyser) return 0;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    let level = 0;
    for (let i = 0; i < dataArray.length; i++) {
      level += dataArray[i];
    }
    
    return (level / dataArray.length) / 255;
  }

  // Method to show/hide the monitor
  toggleMonitorVisibility(show) {
    const indicator = document.getElementById('screen-share-audio-indicator');
    if (indicator) {
      indicator.style.display = show ? 'block' : 'none';
    }
  }
}

// Initialize the monitor
const screenShareAudioMonitor = new ScreenShareAudioMonitor();

// Make it globally accessible
window.screenShareAudioMonitor = screenShareAudioMonitor;

console.log('Screen Share Audio Monitor initialized');