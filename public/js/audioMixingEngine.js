// Advanced Audio Mixing Engine for Screen Share
class AudioMixingEngine {
  constructor() {
    this.audioContext = null;
    this.mixerNode = null;
    this.systemAudioSource = null;
    this.microphoneSource = null;
    this.outputDestination = null;
    this.isActive = false;
    
    // Audio processing parameters
    this.systemAudioGain = 1.0;
    this.microphoneGain = 0.7;
    this.masterGain = 1.0;
    
    this.init();
  }

  async init() {
    try {
      // Create audio context with optimal settings for mixing
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });

      console.log('Audio mixing engine initialized');
    } catch (error) {
      console.error('Failed to initialize audio mixing engine:', error);
    }
  }

  async createMixedAudioStream(systemAudioTrack, microphoneTrack = null) {
    try {
      if (!this.audioContext) {
        await this.init();
      }

      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Create audio sources
      this.systemAudioSource = this.audioContext.createMediaStreamSource(
        new MediaStream([systemAudioTrack])
      );

      // Create gain nodes for volume control
      const systemGain = this.audioContext.createGain();
      const micGain = this.audioContext.createGain();
      const masterGain = this.audioContext.createGain();

      // Set initial gain values
      systemGain.gain.value = this.systemAudioGain;
      micGain.gain.value = this.microphoneGain;
      masterGain.gain.value = this.masterGain;

      // Create compressor to prevent clipping
      const compressor = this.audioContext.createDynamicsCompressor();
      compressor.threshold.value = -24;
      compressor.knee.value = 30;
      compressor.ratio.value = 12;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;

      // Create limiter for final output
      const limiter = this.audioContext.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.knee.value = 5;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.01;

      // Create output destination
      this.outputDestination = this.audioContext.createMediaStreamDestination();

      // Connect system audio path
      this.systemAudioSource
        .connect(systemGain)
        .connect(compressor);

      // Connect microphone if available
      if (microphoneTrack && microphoneTrack.enabled) {
        this.microphoneSource = this.audioContext.createMediaStreamSource(
          new MediaStream([microphoneTrack])
        );
        
        // Add noise gate for microphone
        const noiseGate = this.createNoiseGate();
        
        this.microphoneSource
          .connect(noiseGate)
          .connect(micGain)
          .connect(compressor);
        
        console.log('Microphone added to audio mix');
      }

      // Final processing chain
      compressor
        .connect(masterGain)
        .connect(limiter)
        .connect(this.outputDestination);

      // Store gain nodes for real-time control
      this.mixerNode = {
        systemGain,
        micGain,
        masterGain,
        compressor,
        limiter
      };

      this.isActive = true;
      
      console.log('Mixed audio stream created successfully');
      return this.outputDestination.stream;

    } catch (error) {
      console.error('Error creating mixed audio stream:', error);
      // Return original system audio as fallback
      return new MediaStream([systemAudioTrack]);
    }
  }

  createNoiseGate() {
    // Create a simple noise gate using ScriptProcessorNode
    const bufferSize = 4096;
    const processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
    
    let gateThreshold = 0.01;
    let gateRatio = 0.1;
    let isGateOpen = false;
    let smoothingFactor = 0.95;
    let currentLevel = 0;

    processor.onaudioprocess = (event) => {
      const inputBuffer = event.inputBuffer.getChannelData(0);
      const outputBuffer = event.outputBuffer.getChannelData(0);
      
      // Calculate RMS level
      let rms = 0;
      for (let i = 0; i < inputBuffer.length; i++) {
        rms += inputBuffer[i] * inputBuffer[i];
      }
      rms = Math.sqrt(rms / inputBuffer.length);
      
      // Smooth the level
      currentLevel = currentLevel * smoothingFactor + rms * (1 - smoothingFactor);
      
      // Apply gate
      let gateGain = 1.0;
      if (currentLevel < gateThreshold) {
        if (isGateOpen) {
          gateGain = gateRatio;
          isGateOpen = false;
        } else {
          gateGain = gateRatio;
        }
      } else {
        isGateOpen = true;
        gateGain = 1.0;
      }
      
      // Apply gain to output
      for (let i = 0; i < inputBuffer.length; i++) {
        outputBuffer[i] = inputBuffer[i] * gateGain;
      }
    };

    return processor;
  }

  // Real-time audio level monitoring
  startAudioLevelMonitoring(callback) {
    if (!this.outputDestination) return;

    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    this.mixerNode.masterGain.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const timeArray = new Uint8Array(analyser.fftSize);

    const updateLevels = () => {
      if (!this.isActive) return;

      analyser.getByteFrequencyData(dataArray);
      analyser.getByteTimeDomainData(timeArray);

      // Calculate RMS for overall level
      let rms = 0;
      for (let i = 0; i < timeArray.length; i++) {
        const sample = (timeArray[i] - 128) / 128;
        rms += sample * sample;
      }
      rms = Math.sqrt(rms / timeArray.length);

      // Calculate frequency distribution
      let lowFreq = 0, midFreq = 0, highFreq = 0;
      const third = dataArray.length / 3;
      
      for (let i = 0; i < third; i++) lowFreq += dataArray[i];
      for (let i = third; i < third * 2; i++) midFreq += dataArray[i];
      for (let i = third * 2; i < dataArray.length; i++) highFreq += dataArray[i];
      
      lowFreq /= third;
      midFreq /= third;
      highFreq /= third;

      if (callback) {
        callback({
          rms: rms,
          peak: Math.max(...timeArray.map(v => Math.abs(v - 128) / 128)),
          frequency: { low: lowFreq, mid: midFreq, high: highFreq }
        });
      }

      requestAnimationFrame(updateLevels);
    };

    updateLevels();
  }

  // Adjust audio levels in real-time
  setSystemAudioLevel(level) {
    if (this.mixerNode && this.mixerNode.systemGain) {
      this.systemAudioGain = Math.max(0, Math.min(2, level));
      this.mixerNode.systemGain.gain.setValueAtTime(
        this.systemAudioGain,
        this.audioContext.currentTime
      );
    }
  }

  setMicrophoneLevel(level) {
    if (this.mixerNode && this.mixerNode.micGain) {
      this.microphoneGain = Math.max(0, Math.min(2, level));
      this.mixerNode.micGain.gain.setValueAtTime(
        this.microphoneGain,
        this.audioContext.currentTime
      );
    }
  }

  setMasterLevel(level) {
    if (this.mixerNode && this.mixerNode.masterGain) {
      this.masterGain = Math.max(0, Math.min(2, level));
      this.mixerNode.masterGain.gain.setValueAtTime(
        this.masterGain,
        this.audioContext.currentTime
      );
    }
  }

  // Get current audio levels
  getAudioLevels() {
    return {
      systemAudio: this.systemAudioGain,
      microphone: this.microphoneGain,
      master: this.masterGain
    };
  }

  // Clean up resources
  destroy() {
    this.isActive = false;
    
    if (this.systemAudioSource) {
      this.systemAudioSource.disconnect();
    }
    
    if (this.microphoneSource) {
      this.microphoneSource.disconnect();
    }
    
    if (this.mixerNode) {
      Object.values(this.mixerNode).forEach(node => {
        if (node && node.disconnect) {
          node.disconnect();
        }
      });
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    
    console.log('Audio mixing engine destroyed');
  }
}

// Initialize global audio mixing engine
window.audioMixingEngine = new AudioMixingEngine();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioMixingEngine;
}