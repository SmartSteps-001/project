// Initialize noise suppression when the page loads
(function() {
  'use strict';
  
  // Enhanced noise suppression initialization
  function initializeNoiseSuppression() {
    // Wait for the main meeting system to be ready
    const checkReady = () => {
      if (window.hostMeetingInstance && window.hostMeetingInstance.webrtc) {
        // Hook into the WebRTC initialization
        const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
        
        navigator.mediaDevices.getUserMedia = async function(constraints) {
          const stream = await originalGetUserMedia.call(this, constraints);
          
          // Apply noise suppression if available and audio is requested
          if (constraints.audio && window.noiseSuppressionManager) {
            return await window.noiseSuppressionManager.attachToStream(stream);
          }
          
          return stream;
        };
        
        console.log('Noise suppression integration complete');
      } else {
        // Check again in 100ms
        setTimeout(checkReady, 100);
      }
    };
    
    checkReady();
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeNoiseSuppression);
  } else {
    initializeNoiseSuppression();
  }
  
  // Advanced audio processing utilities
  window.AudioProcessingUtils = {
    // Real-time spectral analysis
    analyzeSpectrum: function(audioData) {
      const fftSize = 2048;
      const spectrum = new Float32Array(fftSize / 2);
      
      // Simplified spectral analysis
      for (let i = 0; i < spectrum.length; i++) {
        let real = 0, imag = 0;
        for (let j = 0; j < audioData.length; j++) {
          const angle = -2 * Math.PI * i * j / audioData.length;
          real += audioData[j] * Math.cos(angle);
          imag += audioData[j] * Math.sin(angle);
        }
        spectrum[i] = Math.sqrt(real * real + imag * imag);
      }
      
      return spectrum;
    },
    
    // Adaptive noise gate
    adaptiveNoiseGate: function(audioLevel, threshold = -40) {
      const linearThreshold = Math.pow(10, threshold / 20);
      const gateRatio = 0.1;
      
      if (audioLevel < linearThreshold) {
        return audioLevel * gateRatio;
      }
      
      return audioLevel;
    },
    
    // Dynamic range compression
    compress: function(audioLevel, threshold = -20, ratio = 4) {
      const linearThreshold = Math.pow(10, threshold / 20);
      
      if (audioLevel > linearThreshold) {
        const excess = audioLevel - linearThreshold;
        return linearThreshold + (excess / ratio);
      }
      
      return audioLevel;
    }
  };
  
})();