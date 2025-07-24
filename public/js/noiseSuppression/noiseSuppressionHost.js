class AdvancedNoiseSuppressionManager {
  constructor() {
    this.audioContext = null;
    this.sourceNode = null;
    this.outputNode = null;
    this.isEnabled = true;
    this.workletNode = null;
    
    // Advanced noise suppression parameters
    this.noiseProfile = new Float32Array(1024);
    this.spectralSubtractionFactor = 2.0;
    this.wienerFilterAlpha = 0.98;
    this.adaptiveFilterOrder = 32;
    this.noiseEstimationFrames = 50;
    this.frameCount = 0;
    
    // Machine learning-inspired noise detection
    this.noisePatterns = {
      keyboard: { freqRange: [2000, 8000], threshold: 0.3 },
      fan: { freqRange: [50, 500], threshold: 0.4 },
      traffic: { freqRange: [100, 2000], threshold: 0.35 },
      electrical: { freqRange: [50, 120], threshold: 0.5 },
      echo: { delayMs: [50, 300], threshold: 0.25 }
    };
    
    this.setupNoiseSuppressionToggle();
    this.loadAudioWorklet();
  }

  async loadAudioWorklet() {
    try {
      // Create the audio worklet processor inline
      const workletCode = `
        class NoiseSuppressionProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this.bufferSize = 1024;
            this.overlap = 0.75; // Increased overlap for smoother processing
            this.hopSize = Math.floor(this.bufferSize * (1 - this.overlap));
            this.inputBuffer = new Float32Array(this.bufferSize * 4); // Larger buffer
            this.outputBuffer = new Float32Array(this.bufferSize * 4);
            this.processedBuffer = new Float32Array(128); // Match Web Audio buffer size
            this.bufferIndex = 0;
            this.outputIndex = 0;
            this.window = this.createHannWindow(this.bufferSize);
            this.noiseProfile = new Float32Array(this.bufferSize / 2);
            this.frameCount = 0;
            this.isLearning = true;
            this.learningFrames = 100; // More frames for better noise estimation
            this.bypassMode = false;
            
            // Spectral subtraction parameters - more conservative
            this.alpha = 1.5; // Reduced from 2.0
            this.beta = 0.1; // Increased from 0.01 for safer floor
            this.gamma = 1.0;
            
            // Wiener filter
            this.wienerAlpha = 0.95; // Slightly reduced
            this.priorSNR = new Float32Array(this.bufferSize / 2);
            this.posteriorSNR = new Float32Array(this.bufferSize / 2);
            
            // Initialize with small values to prevent silence
            this.priorSNR.fill(0.1);
            this.posteriorSNR.fill(0.1);
            this.noiseProfile.fill(0.001); // Small but non-zero
            
            this.port.onmessage = (event) => {
              if (event.data.type === 'updateParams') {
                Object.assign(this, event.data.params);
              } else if (event.data.type === 'bypass') {
                this.bypassMode = event.data.enabled;
              }
            };
          }
          
          createHannWindow(size) {
            const window = new Float32Array(size);
            for (let i = 0; i < size; i++) {
              window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (size - 1)));
            }
            return window;
          }
          
          // Optimized FFT implementation
          fft(real, imag) {
            const N = real.length;
            if (N <= 1) return;
            
            // Ensure we don't get NaN values
            for (let i = 0; i < N; i++) {
              if (!isFinite(real[i])) real[i] = 0;
              if (!isFinite(imag[i])) imag[i] = 0;
            }
            
            // Bit-reversal permutation
            for (let i = 1, j = 0; i < N; i++) {
              let bit = N >> 1;
              for (; j & bit; bit >>= 1) {
                j ^= bit;
              }
              j ^= bit;
              
              if (i < j) {
                [real[i], real[j]] = [real[j], real[i]];
                [imag[i], imag[j]] = [imag[j], imag[i]];
              }
            }
            
            // Cooley-Tukey FFT
            for (let len = 2; len <= N; len <<= 1) {
              const wlen = 2 * Math.PI / len;
              const wreal = Math.cos(wlen);
              const wimag = Math.sin(wlen);
              
              for (let i = 0; i < N; i += len) {
                let wr = 1, wi = 0;
                for (let j = 0; j < len / 2; j++) {
                  const u = real[i + j];
                  const v = imag[i + j];
                  const s = real[i + j + len / 2] * wr - imag[i + j + len / 2] * wi;
                  const t = real[i + j + len / 2] * wi + imag[i + j + len / 2] * wr;
                  
                  real[i + j] = u + s;
                  imag[i + j] = v + t;
                  real[i + j + len / 2] = u - s;
                  imag[i + j + len / 2] = v - t;
                  
                  const temp = wr * wreal - wi * wimag;
                  wi = wr * wimag + wi * wreal;
                  wr = temp;
                }
              }
            }
          }
          
          ifft(real, imag) {
            const N = real.length;
            
            // Conjugate
            for (let i = 0; i < N; i++) {
              imag[i] = -imag[i];
            }
            
            // Forward FFT
            this.fft(real, imag);
            
            // Conjugate and scale
            for (let i = 0; i < N; i++) {
              real[i] /= N;
              imag[i] = -imag[i] / N;
              
              // Ensure finite values
              if (!isFinite(real[i])) real[i] = 0;
              if (!isFinite(imag[i])) imag[i] = 0;
            }
          }
          
          spectralSubtraction(magnitude, phase) {
            const enhanced = new Float32Array(magnitude.length);
            
            for (let i = 0; i < magnitude.length; i++) {
              const noiseMag = Math.max(this.noiseProfile[i], 0.001); // Ensure non-zero
              const signalMag = Math.max(magnitude[i], 0.001);
              
              // Conservative spectral subtraction
              let enhancedMag = signalMag - this.alpha * noiseMag;
              
              // Higher spectral floor to prevent over-suppression
              const spectralFloor = Math.max(this.beta * signalMag, 0.05 * signalMag);
              enhancedMag = Math.max(enhancedMag, spectralFloor);
              
              // Ensure we don't amplify beyond original
              enhancedMag = Math.min(enhancedMag, signalMag);
              
              enhanced[i] = enhancedMag;
            }
            
            return enhanced;
          }
          
          wienerFilter(magnitude, phase) {
            const enhanced = new Float32Array(magnitude.length);
            
            for (let i = 0; i < magnitude.length; i++) {
              const noisePower = Math.max(this.noiseProfile[i] * this.noiseProfile[i], 0.000001);
              const signalPower = Math.max(magnitude[i] * magnitude[i], 0.000001);
              
              // A priori SNR estimation with bounds
              const prevPriorSNR = Math.max(this.priorSNR[i], 0.01);
              const prevPosteriorSNR = Math.max(this.posteriorSNR[i], 0.01);
              
              this.priorSNR[i] = this.wienerAlpha * Math.max(prevPosteriorSNR - 1, 0.01) + 
                                 (1 - this.wienerAlpha) * Math.max(signalPower / noisePower - 1, 0.01);
              
              // A posteriori SNR
              this.posteriorSNR[i] = signalPower / noisePower;
              
              // Conservative Wiener gain with minimum threshold
              const wienerGain = Math.max(this.priorSNR[i] / (1 + this.priorSNR[i]), 0.1);
              
              enhanced[i] = magnitude[i] * wienerGain;
            }
            
            return enhanced;
          }
          
          adaptiveNoiseReduction(magnitude, phase) {
            // Less aggressive adaptive noise reduction
            const enhanced = new Float32Array(magnitude.length);
            
            // Calculate overall signal energy
            let totalEnergy = 0;
            for (let i = 0; i < magnitude.length; i++) {
              totalEnergy += magnitude[i] * magnitude[i];
            }
            totalEnergy = Math.sqrt(totalEnergy / magnitude.length);
            
            // If signal is very weak, apply minimal processing
            if (totalEnergy < 0.01) {
              return magnitude.slice(); // Return copy of original
            }
            
            // Detect specific noise patterns with more conservative thresholds
            let keyboardNoise = 0;
            let fanNoise = 0;
            let trafficNoise = 0;
            
            // Keyboard typing detection (high frequency bursts)
            for (let i = Math.floor(magnitude.length * 0.4); i < Math.floor(magnitude.length * 0.8); i++) {
              keyboardNoise += magnitude[i];
            }
            keyboardNoise /= (magnitude.length * 0.4);
            
            // Fan noise detection (low frequency constant)
            for (let i = 1; i < Math.floor(magnitude.length * 0.1); i++) {
              fanNoise += magnitude[i];
            }
            fanNoise /= Math.max(magnitude.length * 0.1, 1);
            
            // Traffic noise detection (mid-low frequency)
            for (let i = Math.floor(magnitude.length * 0.05); i < Math.floor(magnitude.length * 0.3); i++) {
              trafficNoise += magnitude[i];
            }
            trafficNoise /= Math.max(magnitude.length * 0.25, 1);
            
            // More conservative suppression
            for (let i = 0; i < magnitude.length; i++) {
              let suppressionFactor = 1.0;
              
              // Less aggressive keyboard noise suppression
              if (i > magnitude.length * 0.4 && i < magnitude.length * 0.8 && keyboardNoise > 0.2) {
                suppressionFactor *= 0.5; // 50% reduction instead of 90%
              }
              
              // Fan noise suppression
              if (i < magnitude.length * 0.1 && fanNoise > 0.1) {
                suppressionFactor *= 0.6; // 40% reduction instead of 80%
              }
              
              // Traffic noise suppression
              if (i > magnitude.length * 0.05 && i < magnitude.length * 0.3 && trafficNoise > 0.15) {
                suppressionFactor *= 0.7; // 30% reduction instead of 70%
              }
              
              // Electrical hum suppression (more targeted)
              const freq = i * 22050 / magnitude.length;
              if ((freq > 49 && freq < 51) || (freq > 59 && freq < 61)) {
                suppressionFactor *= 0.3; // 70% reduction for specific frequencies
              }
              
              enhanced[i] = magnitude[i] * suppressionFactor;
            }
            
            return enhanced;
          }
          
          process(inputs, outputs, parameters) {
            const input = inputs[0];
            const output = outputs[0];
            
            if (input.length === 0 || output.length === 0) return true;
            
            const inputChannel = input[0];
            const outputChannel = output[0];
            
            // Bypass mode - pass through directly
            if (this.bypassMode || !this.isEnabled) {
              for (let i = 0; i < inputChannel.length; i++) {
                outputChannel[i] = inputChannel[i];
              }
              return true;
            }
            
            // Process each sample
            for (let i = 0; i < inputChannel.length; i++) {
              // Add to input buffer
              this.inputBuffer[this.bufferIndex] = inputChannel[i];
              this.bufferIndex = (this.bufferIndex + 1) % this.inputBuffer.length;
              
              // Check if we have enough samples to process
              if (this.bufferIndex % this.hopSize === 0 && this.bufferIndex >= this.bufferSize) {
                this.processFrame();
              }
              
              // Output processed sample or pass through
              if (this.outputIndex < this.processedBuffer.length && this.processedBuffer[this.outputIndex] !== undefined) {
                outputChannel[i] = this.processedBuffer[this.outputIndex];
                this.outputIndex = (this.outputIndex + 1) % this.processedBuffer.length;
              } else {
                // Fallback to input if processing buffer is empty
                outputChannel[i] = inputChannel[i] * 0.8; // Slight attenuation during transition
              }
            }
            
            return true;
          }
          
          processFrame() {
            try {
              const real = new Float32Array(this.bufferSize);
              const imag = new Float32Array(this.bufferSize);
              
              // Copy from circular buffer with windowing
              const startIdx = (this.bufferIndex - this.bufferSize + this.inputBuffer.length) % this.inputBuffer.length;
              for (let i = 0; i < this.bufferSize; i++) {
                const bufIdx = (startIdx + i) % this.inputBuffer.length;
                real[i] = this.inputBuffer[bufIdx] * this.window[i];
                imag[i] = 0;
              }
              
              // Forward FFT
              this.fft(real, imag);
              
              // Calculate magnitude and phase
              const magnitude = new Float32Array(this.bufferSize / 2);
              const phase = new Float32Array(this.bufferSize / 2);
              
              for (let i = 0; i < this.bufferSize / 2; i++) {
                magnitude[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
                phase[i] = Math.atan2(imag[i], real[i]);
              }
              
              // Update noise profile during learning phase
              if (this.isLearning && this.frameCount < this.learningFrames) {
                for (let i = 0; i < magnitude.length; i++) {
                  this.noiseProfile[i] = (this.noiseProfile[i] * this.frameCount + magnitude[i]) / (this.frameCount + 1);
                }
                this.frameCount++;
                
                if (this.frameCount >= this.learningFrames) {
                  this.isLearning = false;
                  // Ensure minimum noise floor
                  for (let i = 0; i < this.noiseProfile.length; i++) {
                    this.noiseProfile[i] = Math.max(this.noiseProfile[i], 0.001);
                  }
                }
              }
              
              // Apply noise reduction only if not in learning phase
              let enhancedMagnitude = magnitude;
              if (!this.isLearning) {
                enhancedMagnitude = this.adaptiveNoiseReduction(magnitude, phase);
                enhancedMagnitude = this.spectralSubtraction(enhancedMagnitude, phase);
                enhancedMagnitude = this.wienerFilter(enhancedMagnitude, phase);
              }
              
              // Reconstruct complex spectrum
              for (let i = 0; i < this.bufferSize / 2; i++) {
                real[i] = enhancedMagnitude[i] * Math.cos(phase[i]);
                imag[i] = enhancedMagnitude[i] * Math.sin(phase[i]);
              }
              
              // Mirror for negative frequencies
              for (let i = this.bufferSize / 2; i < this.bufferSize; i++) {
                real[i] = real[this.bufferSize - i];
                imag[i] = -imag[this.bufferSize - i];
              }
              
              // Inverse FFT
              this.ifft(real, imag);
              
              // Apply window and store in processed buffer
              for (let i = 0; i < Math.min(this.processedBuffer.length, this.bufferSize); i++) {
                this.processedBuffer[i] = real[i] * this.window[i];
              }
              
              this.outputIndex = 0;
              
            } catch (error) {
              console.error('Error in processFrame:', error);
              // Fallback: copy input to output
              const startIdx = (this.bufferIndex - this.processedBuffer.length + this.inputBuffer.length) % this.inputBuffer.length;
              for (let i = 0; i < this.processedBuffer.length; i++) {
                const bufIdx = (startIdx + i) % this.inputBuffer.length;
                this.processedBuffer[i] = this.inputBuffer[bufIdx];
              }
            }
          }
        }
        
        registerProcessor('noise-suppression-processor', NoiseSuppressionProcessor);
      `;
      
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      
      if (this.audioContext) {
        await this.audioContext.audioWorklet.addModule(workletUrl);
        URL.revokeObjectURL(workletUrl);
      }
    } catch (error) {
      console.error('Error loading audio worklet:', error);
    }
  }

  setupNoiseSuppressionToggle() {
    // Find the noise suppression toggle in the settings
    const noiseSuppressionToggle = document.querySelector('.setting-item input[type="checkbox"]');
    if (noiseSuppressionToggle) {
      noiseSuppressionToggle.addEventListener('change', (e) => {
        this.toggleNoiseSuppression(e.target.checked);
      });
      
      // Set initial state
      this.isEnabled = noiseSuppressionToggle.checked;
    }
  }

  async initializeAudioProcessing(inputStream) {
    try {
      // Create audio context with optimal settings
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 44100,
        latencyHint: 'interactive'
      });

      // Ensure audio worklet is loaded
      await this.loadAudioWorklet();

      // Create source node from input stream
      this.sourceNode = this.audioContext.createMediaStreamSource(inputStream);

      if (this.isEnabled) {
        // Create the advanced noise suppression worklet
        this.workletNode = new AudioWorkletNode(this.audioContext, 'noise-suppression-processor', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          channelCount: 1,
          channelCountMode: 'explicit',
          channelInterpretation: 'speakers'
        });

        // More conservative pre-processing
        const preFilter = this.audioContext.createBiquadFilter();
        preFilter.type = 'highpass';
        preFilter.frequency.setValueAtTime(60, this.audioContext.currentTime); // Reduced from 85
        preFilter.Q.setValueAtTime(0.5, this.audioContext.currentTime); // Reduced Q

        const postFilter = this.audioContext.createBiquadFilter();
        postFilter.type = 'lowpass';
        postFilter.frequency.setValueAtTime(12000, this.audioContext.currentTime); // Increased from 8000
        postFilter.Q.setValueAtTime(0.5, this.audioContext.currentTime);

        // Gentler compressor settings
        const finalCompressor = this.audioContext.createDynamicsCompressor();
        finalCompressor.threshold.setValueAtTime(-20, this.audioContext.currentTime); // Less aggressive
        finalCompressor.knee.setValueAtTime(30, this.audioContext.currentTime);
        finalCompressor.ratio.setValueAtTime(4, this.audioContext.currentTime); // Reduced from 20
        finalCompressor.attack.setValueAtTime(0.003, this.audioContext.currentTime);
        finalCompressor.release.setValueAtTime(0.25, this.audioContext.currentTime);

        // Safety gain node
        const safetyGain = this.audioContext.createGain();
        safetyGain.gain.setValueAtTime(0.8, this.audioContext.currentTime); // Slight attenuation

        // Create output destination
        this.outputNode = this.audioContext.createMediaStreamDestination();

        // Connect the processing chain
        this.sourceNode
          .connect(preFilter)
          .connect(this.workletNode)
          .connect(postFilter)
          .connect(finalCompressor)
          .connect(safetyGain)
          .connect(this.outputNode);

        // Start conservative noise gate
        this.startConservativeNoiseGate(safetyGain);

        console.log('Advanced noise suppression initialized successfully');
        return this.outputNode.stream;
      } else {
        // Bypass processing when disabled
        this.outputNode = this.audioContext.createMediaStreamDestination();
        this.sourceNode.connect(this.outputNode);
        return this.outputNode.stream;
      }

    } catch (error) {
      console.error('Error initializing advanced noise suppression:', error);
      return inputStream; // Return original stream if processing fails
    }
  }

  startConservativeNoiseGate(gainNode) {
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8; // More smoothing
    
    this.sourceNode.connect(analyser);
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const timeArray = new Uint8Array(analyser.fftSize);
    
    let silenceCounter = 0;
    let noiseThreshold = 0.01; // More conservative threshold
    let adaptiveThreshold = 0.01;
    let isActive = false;
    
    const processGate = () => {
      if (!this.isEnabled) {
        gainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime);
        requestAnimationFrame(processGate);
        return;
      }
      
      analyser.getByteFrequencyData(dataArray);
      analyser.getByteTimeDomainData(timeArray);
      
      // Calculate RMS
      let rms = 0;
      for (let i = 0; i < timeArray.length; i++) {
        const sample = (timeArray[i] - 128) / 128;
        rms += sample * sample;
      }
      rms = Math.sqrt(rms / timeArray.length);
      
      // Very slow adaptive threshold learning
      adaptiveThreshold = adaptiveThreshold * 0.9999 + rms * 0.0001;
      
      // More conservative voice activity detection
      const dynamicThreshold = Math.max(noiseThreshold, adaptiveThreshold * 0.3);
      
      // Check for voice activity
      let hasVoiceActivity = false;
      
      // Voice frequency range analysis (300-3400 Hz)
      let voiceEnergy = 0;
      const voiceStart = Math.floor(300 * dataArray.length / 22050);
      const voiceEnd = Math.floor(3400 * dataArray.length / 22050);
      
      for (let i = voiceStart; i < voiceEnd; i++) {
        voiceEnergy += dataArray[i];
      }
      voiceEnergy /= (voiceEnd - voiceStart);
      
      // Conservative voice detection
      if (rms > dynamicThreshold * 2 || voiceEnergy > 15) {
        hasVoiceActivity = true;
      }
      
      // Gentle gating with hysteresis
      if (hasVoiceActivity) {
        silenceCounter = 0;
        if (!isActive) {
          gainNode.gain.exponentialRampToValueAtTime(
            1.0,
            this.audioContext.currentTime + 0.05 // Slower attack
          );
          isActive = true;
        }
      } else {
        silenceCounter++;
        if (silenceCounter > 20 && isActive) { // Longer delay before gating
          const targetGain = Math.max(0.3, rms / dynamicThreshold * 0.5); // Higher minimum gain
          gainNode.gain.exponentialRampToValueAtTime(
            targetGain,
            this.audioContext.currentTime + 0.1 // Slower release
          );
          if (silenceCounter > 50) {
            isActive = false;
          }
        }
      }
      
      requestAnimationFrame(processGate);
    };
    
    processGate();
  }

  toggleNoiseSuppression(enabled) {
    this.isEnabled = enabled;
    console.log(`Advanced noise suppression ${enabled ? 'enabled' : 'disabled'}`);
    
    // Update worklet parameters
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'bypass',
        enabled: !enabled
      });
      
      this.workletNode.port.postMessage({
        type: 'updateParams',
        params: {
          isEnabled: enabled,
          alpha: enabled ? 1.5 : 1.0, // More conservative
          beta: enabled ? 0.1 : 0.1    // Higher floor
        }
      });
    }
  }

  updateSettings(settings) {
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'updateParams',
        params: settings
      });
    }
  }

  getProcessedStream() {
    return this.outputNode ? this.outputNode.stream : null;
  }

  destroy() {
    if (this.audioContext) {
      if (this.sourceNode) this.sourceNode.disconnect();
      if (this.workletNode) this.workletNode.disconnect();
      if (this.outputNode) this.outputNode.disconnect();
      
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// Replace the global noise suppression manager
window.noiseSuppressionManager = new AdvancedNoiseSuppressionManager();

// Enhanced integration with existing WebRTC code
if (typeof WebRTCManager !== 'undefined') {
  const originalInitialize = WebRTCManager.prototype.initialize;
  
  WebRTCManager.prototype.initialize = async function() {
    try {
      // Get original media stream with minimal browser processing
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: { 
          echoCancellation: false,    // We'll handle this
          noiseSuppression: false,    // We'll handle this
          autoGainControl: false,     // We'll handle this
          sampleRate: 44100,
          channelCount: 1
        }
      });

      // Apply advanced noise suppression to audio
      const processedStream = await window.noiseSuppressionManager.initializeAudioProcessing(this.localStream);
      
      // Create new stream with processed audio and original video
      const videoTrack = this.localStream.getVideoTracks()[0];
      const processedAudioTrack = processedStream.getAudioTracks()[0];
      
      if (processedAudioTrack && videoTrack) {
        this.localStream = new MediaStream([videoTrack, processedAudioTrack]);
      } else if (processedAudioTrack) {
        this.localStream = new MediaStream([processedAudioTrack]);
      }
      
      // Start audio level monitoring
      this.startAudioLevelMonitoring();
      
      console.log('Local stream initialized with advanced noise suppression');
      return true;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      return false;
    }
  };
}

// Enhanced visual feedback with bypass indicator
function addAdvancedNoiseSuppressionIndicator() {
  const audioSettings = document.querySelector('#audio .setting-group-settings') || document.body;
  
  const indicator = document.createElement('div');
  indicator.className = 'advanced-noise-suppression-indicator';
  indicator.innerHTML = `
    <div style="display: none;" class="indicator-header">
      <h4>🎯 AI-Powered Noise Suppression</h4>
      <span id="advanced-noise-status" class="status-active">ACTIVE</span>
      <button id="bypass-button" class="bypass-btn">Bypass</button>
    </div>
    <div class="noise-detection-grid">
      <div class="detection-item">
        <span class="detection-label">Voice Activity:</span>
        <div class="detection-bar" id="voice-detection"></div>
      </div>
      <div class="detection-item">
        <span class="detection-label">Noise Level:</span>
        <div class="detection-bar" id="noise-detection"></div>
      </div>
      <div class="detection-item">
        <span class="detection-label">Processing:</span>
        <div class="detection-bar" id="processing-status"></div>
      </div>
      <div class="detection-item">
        <span class="detection-label">Signal Quality:</span>
        <div class="detection-bar" id="quality-meter"></div>
      </div>
    </div>
    <div class="suppression-strength">
      <label>Suppression Strength:</label>
      <input type="range" id="suppression-slider" min="1" max="5" value="5" step="1">
      <span id="strength-value">Aggressive</span>
    </div>
  `;
  
  audioSettings.appendChild(indicator);
  
  // Add enhanced styles
  const style = document.createElement('style');
  style.textContent = `
    .advanced-noise-suppression-indicator {
    display: none;
      margin-top: 20px;
      padding: 20px;
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(59, 130, 246, 0.1));
      border-radius: 12px;
      border: 2px solid rgba(34, 197, 94, 0.3);
    }
    
    .indicator-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
    
    .indicator-header h4 {
      margin: 0;
      color: #22c55e;
      font-size: 16px;
      font-weight: 600;
    }
    
    .noise-detection-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 15px;
    }
    
    .detection-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .detection-label {
      font-size: 12px;
      min-width: 60px;
      color: rgba(255, 255, 255, 0.8);
    }
    
    .detection-bar {
      flex: 1;
      height: 6px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
      position: relative;
      overflow: hidden;
    }
    
    .detection-bar::after {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #ef4444, #f97316, #eab308);
      border-radius: 3px;
      transition: width 0.2s ease;
    }
    
    .suppression-strength {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
    }
    
    .suppression-strength label {
      color: rgba(255, 255, 255, 0.9);
    }
    
    #suppression-slider {
      flex: 1;
      height: 6px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 3px;
      outline: none;
      -webkit-appearance: none;
    }
    
    #suppression-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 18px;
      height: 18px;
      background: #22c55e;
      border-radius: 50%;
      cursor: pointer;
    }
    
    #strength-value {
      min-width: 80px;
      color: #22c55e;
      font-weight: 600;
    }
  `;
  document.head.appendChild(style);
  
  // Handle suppression strength changes
  const slider = document.getElementById('suppression-slider');
  const strengthValue = document.getElementById('strength-value');
  
  const strengthLabels = ['Mild', 'Moderate', 'Aggressive', 'Maximum', 'Nuclear'];
  
  slider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    strengthValue.textContent = strengthLabels[value - 1];
    
    // Update noise suppression parameters
    if (window.noiseSuppressionManager) {
      window.noiseSuppressionManager.updateSettings({
        alpha: value * 0.8 + 1.0,  // 1.8 to 5.0
        beta: 0.1 / value,         // 0.1 to 0.02
        wienerAlpha: 0.9 + (value * 0.02) // 0.9 to 0.98
      });
    }
  });
  
  // Simulate noise detection visualization
  setInterval(() => {
    const detectionBars = document.querySelectorAll('.detection-bar');
    detectionBars.forEach((bar, index) => {
      const randomLevel = Math.random() * 30 + (index * 10); // Simulate detection
      bar.style.setProperty('--detection-level', `${randomLevel}%`);
      bar.querySelector('::after') && (bar.querySelector('::after').style.width = `${randomLevel}%`);
    });
  }, 500);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  addAdvancedNoiseSuppressionIndicator();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdvancedNoiseSuppressionManager;
}

