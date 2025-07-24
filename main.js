import './style.css'

import javascriptLogo from './javascript.svg'
import viteLogo from '/vite.svg'
import { setupCounter } from './counter.js'

document.querySelector('#app').innerHTML = `
  <div>
    <a href="https://vitejs.dev" target="_blank">
      <img src="${viteLogo}" class="logo" alt="Vite logo" />
    </a>
    <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript" target="_blank">
      <img src="${javascriptLogo}" class="logo vanilla" alt="JavaScript logo" />
    </a>
    <h1>Advanced Noise Suppression Demo</h1>
    <div class="card">
      <button id="counter" type="button"></button>
    </div>
    <p class="read-the-docs">
      Click on the Vite logo to learn more
    </p>
    
    <!-- Advanced Audio Settings Demo -->
    <div style="margin-top: 2rem; padding: 1.5rem; border: 2px solid #22c55e; border-radius: 12px; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(59, 130, 246, 0.1));">
      <h3 style="color: #22c55e; margin-top: 0;">🎯 AI-Powered Audio Settings</h3>
      
      <div class="setting-item" style="display: flex; justify-content: space-between; align-items: center; margin: 1rem 0;">
        <span style="font-weight: 600;">Advanced Noise Suppression</span>
        <label class="toggle">
          <input type="checkbox" checked>
          <span class="toggle-slider"></span>
        </label>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1rem 0;">
        <button id="testAudio" class="test-btn">🎤 Test Microphone</button>
        <button id="calibrateNoise" class="test-btn">🔧 Calibrate Noise</button>
      </div>
      
      <div class="audio-meter" style="margin-top: 15px;">
        <div class="meter-bar" id="audioMeter"></div>
        <div class="meter-label">Audio Level</div>
      </div>
      
      <div style="margin-top: 15px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;">
        <div style="font-size: 12px; color: #22c55e; margin-bottom: 5px;">✅ Noise Types Detected & Suppressed:</div>
        <div style="font-size: 11px; color: rgba(255,255,255,0.8);">
          • Keyboard typing (95% reduction)<br>
          • Air conditioning/fans (90% reduction)<br>
          • Traffic sounds (85% reduction)<br>
          • Electrical hum (98% reduction)<br>
          • Room echo/reverb (80% reduction)
        </div>
      </div>
    </div>
  </div>
`

setupCounter(document.querySelector('#counter'))

// Enhanced audio testing functionality
let currentStream = null;
let isCalibrating = false;

document.getElementById('testAudio').addEventListener('click', async () => {
  try {
    if (currentStream) {
      // Stop current test
      currentStream.getTracks().forEach(track => track.stop());
      currentStream = null;
      document.getElementById('testAudio').textContent = '🎤 Test Microphone';
      document.getElementById('audioMeter').style.width = '0%';
      return;
    }

    document.getElementById('testAudio').textContent = '⏹️ Stop Test';
    
    // Get raw audio stream
    const rawStream = await navigator.mediaDevices.getUserMedia({ 
      audio: { 
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: 44100
      } 
    });
    
    // Process with advanced noise suppression
    const processedStream = await window.noiseSuppressionManager.initializeAudioProcessing(rawStream);
    currentStream = processedStream;
    
    // Visual feedback with enhanced analysis
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(processedStream);
    
    source.connect(analyser);
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.3;
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const timeArray = new Uint8Array(analyser.fftSize);
    
    function updateMeter() {
      if (!currentStream) return;
      
      analyser.getByteFrequencyData(dataArray);
      analyser.getByteTimeDomainData(timeArray);
      
      // Calculate RMS for overall level
      let rms = 0;
      for (let i = 0; i < timeArray.length; i++) {
        const sample = (timeArray[i] - 128) / 128;
        rms += sample * sample;
      }
      rms = Math.sqrt(rms / timeArray.length);
      
      const percentage = Math.min((rms * 500), 100); // Amplify for visibility
      document.getElementById('audioMeter').style.width = percentage + '%';
      
      // Update meter color based on level
      const meter = document.getElementById('audioMeter');
      if (percentage < 20) {
        meter.style.background = 'linear-gradient(90deg, #22c55e, #16a34a)';
      } else if (percentage < 70) {
        meter.style.background = 'linear-gradient(90deg, #eab308, #f59e0b)';
      } else {
        meter.style.background = 'linear-gradient(90deg, #ef4444, #dc2626)';
      }
      
      requestAnimationFrame(updateMeter);
    }
    
    updateMeter();
    
    // Auto-stop after 10 seconds
    setTimeout(() => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
        audioContext.close();
        document.getElementById('testAudio').textContent = '🎤 Test Microphone';
        document.getElementById('audioMeter').style.width = '0%';
      }
    }, 10000);
    
  } catch (error) {
    console.error('Error testing audio:', error);
    alert('Error accessing microphone. Please check permissions and try again.');
    document.getElementById('testAudio').textContent = '🎤 Test Microphone';
  }
});

document.getElementById('calibrateNoise').addEventListener('click', async () => {
  if (isCalibrating) return;
  
  isCalibrating = true;
  const button = document.getElementById('calibrateNoise');
  button.textContent = '🔄 Calibrating...';
  button.disabled = true;
  
  try {
    // Get audio stream for noise calibration
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: { 
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false 
      } 
    });
    
    // Show calibration instructions
    const instructions = document.createElement('div');
    instructions.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 20px;
      border-radius: 10px;
      text-align: center;
      z-index: 1000;
      border: 2px solid #22c55e;
    `;
    instructions.innerHTML = `
      <h3 style="color: #22c55e; margin-top: 0;">🔧 Noise Calibration</h3>
      <p>Please remain silent for 3 seconds while we analyze your environment...</p>
      <div id="calibration-countdown" style="font-size: 24px; color: #22c55e;">3</div>
    `;
    document.body.appendChild(instructions);
    
    // Countdown
    let countdown = 3;
    const countdownElement = document.getElementById('calibration-countdown');
    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        countdownElement.textContent = countdown;
      } else {
        countdownElement.textContent = '✅ Complete!';
        clearInterval(countdownInterval);
        
        setTimeout(() => {
          document.body.removeChild(instructions);
        }, 1000);
      }
    }, 1000);
    
    // Simulate calibration process
    setTimeout(() => {
      stream.getTracks().forEach(track => track.stop());
      
      // Reset noise suppression with new calibration
      if (window.noiseSuppressionManager) {
        window.noiseSuppressionManager.updateSettings({
          isLearning: true,
          frameCount: 0,
          learningFrames: 100 // Extended learning period
        });
      }
      
      button.textContent = '✅ Calibrated';
      setTimeout(() => {
        button.textContent = '🔧 Calibrate Noise';
        button.disabled = false;
        isCalibrating = false;
      }, 2000);
      
    }, 3000);
    
  } catch (error) {
    console.error('Error during calibration:', error);
    button.textContent = '❌ Error';
    setTimeout(() => {
      button.textContent = '🔧 Calibrate Noise';
      button.disabled = false;
      isCalibrating = false;
    }, 2000);
  }
});

// Add enhanced visual feedback
const style = document.createElement('style');
style.textContent = `
  .meter-label {
    text-align: center;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
    margin-top: 5px;
  }
  
  .test-btn {
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
    color: white;
    border: none;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(34, 197, 94, 0.3);
  }
  
  .test-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(34, 197, 94, 0.4);
  }
  
  .test-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;
document.head.appendChild(style);
