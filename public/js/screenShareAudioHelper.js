// Screen Share Audio Helper - Provides user guidance and troubleshooting
class ScreenShareAudioHelper {
  constructor() {
    this.setupAudioHelperUI();
    this.setupTroubleshootingGuide();
  }

  setupAudioHelperUI() {
    // Add audio helper button to screen share controls
    const screenShareBtn = document.getElementById('menu-btn') || 
                          document.querySelector('.control-btn:has(i.fa-desktop)');
    
    if (screenShareBtn && screenShareBtn.parentNode) {
      const helperBtn = document.createElement('button');
      helperBtn.className = 'control-btn audio-helper-btn';
      helperBtn.innerHTML = '<i class="fas fa-question-circle"></i>';
      helperBtn.title = 'Screen Share Audio Help';
      helperBtn.style.cssText = `
        margin-left: 4px;
        background: rgba(59, 130, 246, 0.2);
        border: 1px solid rgba(59, 130, 246, 0.3);
      `;
      
      helperBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showTroubleshootingGuide();
      });
      
      screenShareBtn.parentNode.insertBefore(helperBtn, screenShareBtn.nextSibling);
    }
  }

  setupTroubleshootingGuide() {
    const guideModal = document.createElement('div');
    guideModal.id = 'screen-share-audio-guide';
    guideModal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(10px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    `;

    guideModal.innerHTML = `
      <div style="
        background: white;
        border-radius: 20px;
        padding: 40px;
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
      ">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="
            width: 100px;
            height: 100px;
            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
          ">
            <i class="fas fa-desktop" style="font-size: 40px; color: white;"></i>
          </div>
          
          <h2 style="color: #1f2937; margin-bottom: 12px; font-size: 28px; font-weight: 700;">
            Screen Share Audio Guide
          </h2>
          
          <p style="color: #6b7280; font-size: 16px; line-height: 1.6;">
            Follow these steps to ensure your computer audio is shared with other participants
          </p>
        </div>

        <div style="margin-bottom: 32px;">
          <h3 style="color: #1f2937; margin-bottom: 20px; font-size: 20px; font-weight: 600;">
            📋 Step-by-Step Instructions
          </h3>
          
          <div class="instruction-step" style="margin-bottom: 20px;">
            <div style="display: flex; gap: 16px;">
              <div style="
                width: 32px;
                height: 32px;
                background: #3b82f6;
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 700;
                flex-shrink: 0;
              ">1</div>
              <div>
                <h4 style="color: #1f2937; margin-bottom: 8px; font-weight: 600;">Click Screen Share Button</h4>
                <p style="color: #6b7280; line-height: 1.5;">
                  Click the screen share button in the meeting controls. A browser dialog will appear.
                </p>
              </div>
            </div>
          </div>

          <div class="instruction-step" style="margin-bottom: 20px;">
            <div style="display: flex; gap: 16px;">
              <div style="
                width: 32px;
                height: 32px;
                background: #3b82f6;
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 700;
                flex-shrink: 0;
              ">2</div>
              <div>
                <h4 style="color: #1f2937; margin-bottom: 8px; font-weight: 600;">Select "Entire Screen"</h4>
                <p style="color: #6b7280; line-height: 1.5;">
                  Choose "Entire Screen" instead of a specific window for better audio capture compatibility.
                </p>
              </div>
            </div>
          </div>

          <div class="instruction-step" style="margin-bottom: 20px;">
            <div style="display: flex; gap: 16px;">
              <div style="
                width: 32px;
                height: 32px;
                background: #10b981;
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 700;
                flex-shrink: 0;
              ">3</div>
              <div>
                <h4 style="color: #1f2937; margin-bottom: 8px; font-weight: 600;">Enable "Share Audio" ✨</h4>
                <p style="color: #6b7280; line-height: 1.5;">
                  <strong>Most Important:</strong> Look for and check the "Share audio" or "Share system audio" checkbox in the dialog.
                </p>
              </div>
            </div>
          </div>

          <div class="instruction-step">
            <div style="display: flex; gap: 16px;">
              <div style="
                width: 32px;
                height: 32px;
                background: #3b82f6;
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 700;
                flex-shrink: 0;
              ">4</div>
              <div>
                <h4 style="color: #1f2937; margin-bottom: 8px; font-weight: 600;">Click "Share"</h4>
                <p style="color: #6b7280; line-height: 1.5;">
                  Click the "Share" button to start sharing your screen with computer audio.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 32px;">
          <h3 style="color: #1f2937; margin-bottom: 16px; font-size: 18px; font-weight: 600;">
            🔧 Troubleshooting
          </h3>
          
          <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
            <h4 style="color: #1f2937; margin-bottom: 8px; font-weight: 600;">
              ❓ Don't see "Share audio" option?
            </h4>
            <ul style="color: #6b7280; margin: 0; padding-left: 20px; line-height: 1.6;">
              <li>Try selecting "Entire Screen" instead of a window</li>
              <li>Update your browser to the latest version</li>
              <li>Use Chrome or Edge for best compatibility</li>
              <li>Restart your browser and try again</li>
            </ul>
          </div>

          <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
            <h4 style="color: #1f2937; margin-bottom: 8px; font-weight: 600;">
              🔇 Audio not working even with "Share audio" checked?
            </h4>
            <ul style="color: #6b7280; margin: 0; padding-left: 20px; line-height: 1.6;">
              <li>Check your system volume is not muted</li>
              <li>Make sure the application you're sharing is playing audio</li>
              <li>Try sharing a different application or window</li>
              <li>Restart the screen share and try again</li>
            </ul>
          </div>

          <div style="background: #fef3c7; border-radius: 12px; padding: 20px; border-left: 4px solid #f59e0b;">
            <h4 style="color: #92400e; margin-bottom: 8px; font-weight: 600;">
              ⚠️ Important Notes
            </h4>
            <ul style="color: #92400e; margin: 0; padding-left: 20px; line-height: 1.6;">
              <li>Computer audio sharing works even if your microphone is muted</li>
              <li>System volume level doesn't affect shared audio volume</li>
              <li>Other participants will hear your computer audio at normal levels</li>
              <li>You can adjust shared audio levels in the meeting controls</li>
            </ul>
          </div>
        </div>

        <div style="margin-bottom: 24px;">
          <h3 style="color: #1f2937; margin-bottom: 16px; font-size: 18px; font-weight: 600;">
            🧪 Test Your Setup
          </h3>
          
          <div style="display: flex; gap: 12px; flex-wrap: wrap;">
            <button id="test-audio-capture" style="
              background: linear-gradient(135deg, #10b981, #059669);
              color: white;
              border: none;
              padding: 12px 20px;
              border-radius: 8px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s ease;
              flex: 1;
              min-width: 140px;
            ">
              <i class="fas fa-play" style="margin-right: 8px;"></i>
              Test Audio Capture
            </button>
            
            <button id="check-browser-support" style="
              background: linear-gradient(135deg, #3b82f6, #1d4ed8);
              color: white;
              border: none;
              padding: 12px 20px;
              border-radius: 8px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s ease;
              flex: 1;
              min-width: 140px;
            ">
              <i class="fas fa-check" style="margin-right: 8px;"></i>
              Check Browser Support
            </button>
          </div>
        </div>

        <div style="text-align: center;">
          <button id="close-audio-guide" style="
            background: #6b7280;
            color: white;
            border: none;
            padding: 14px 32px;
            border-radius: 10px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 16px;
          ">
            Got It!
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(guideModal);

    // Add event listeners
    this.setupGuideEventListeners();
  }

  setupGuideEventListeners() {
    document.getElementById('close-audio-guide').addEventListener('click', () => {
      this.hideTroubleshootingGuide();
    });

    document.getElementById('test-audio-capture').addEventListener('click', () => {
      this.testAudioCapture();
    });

    document.getElementById('check-browser-support').addEventListener('click', () => {
      this.checkBrowserSupport();
    });

    // Close on outside click
    document.getElementById('screen-share-audio-guide').addEventListener('click', (e) => {
      if (e.target.id === 'screen-share-audio-guide') {
        this.hideTroubleshootingGuide();
      }
    });
  }

  showTroubleshootingGuide() {
    const modal = document.getElementById('screen-share-audio-guide');
    if (modal) {
      modal.style.display = 'flex';
    }
  }

  hideTroubleshootingGuide() {
    const modal = document.getElementById('screen-share-audio-guide');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  async testAudioCapture() {
    const testBtn = document.getElementById('test-audio-capture');
    const originalText = testBtn.innerHTML;
    
    testBtn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i>Testing...';
    testBtn.disabled = true;

    try {
      console.log('Testing audio capture capabilities...');
      
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();

      // Stop the test stream immediately
      stream.getTracks().forEach(track => track.stop());

      if (audioTracks.length > 0) {
        this.showTestResult('✅ Audio Capture Test Passed', 'Your browser can capture computer audio during screen sharing.', 'success');
      } else {
        this.showTestResult('⚠️ Audio Capture Test Failed', 'Your browser or system doesn\'t support computer audio capture. Try the troubleshooting steps above.', 'warning');
      }

    } catch (error) {
      console.error('Audio capture test failed:', error);
      this.showTestResult('❌ Audio Capture Test Error', `Test failed: ${error.message}. Please check your browser permissions.`, 'error');
    }

    testBtn.innerHTML = originalText;
    testBtn.disabled = false;
  }

  checkBrowserSupport() {
    const supportBtn = document.getElementById('check-browser-support');
    const originalText = supportBtn.innerHTML;
    
    supportBtn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i>Checking...';
    supportBtn.disabled = true;

    setTimeout(() => {
      const userAgent = navigator.userAgent;
      const isChrome = userAgent.includes('Chrome') && !userAgent.includes('Edg');
      const isEdge = userAgent.includes('Edg');
      const isFirefox = userAgent.includes('Firefox');
      const isSafari = userAgent.includes('Safari') && !userAgent.includes('Chrome');

      let supportLevel = 'Unknown';
      let recommendation = '';

      if (isChrome) {
        supportLevel = '✅ Excellent';
        recommendation = 'Chrome has the best support for screen share audio capture.';
      } else if (isEdge) {
        supportLevel = '✅ Very Good';
        recommendation = 'Edge has good support for screen share audio capture.';
      } else if (isFirefox) {
        supportLevel = '⚠️ Limited';
        recommendation = 'Firefox has limited support. Consider using Chrome or Edge for better audio capture.';
      } else if (isSafari) {
        supportLevel = '❌ Poor';
        recommendation = 'Safari has poor support for screen share audio. Please use Chrome or Edge.';
      }

      this.showTestResult(
        `Browser Support: ${supportLevel}`,
        recommendation,
        isChrome || isEdge ? 'success' : isFirefox ? 'warning' : 'error'
      );

      supportBtn.innerHTML = originalText;
      supportBtn.disabled = false;
    }, 1000);
  }

  showTestResult(title, message, type) {
    // Create result notification
    const result = document.createElement('div');
    result.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : '#dc2626'};
      color: white;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 8px 25px rgba(0,0,0,0.15);
      z-index: 10001;
      max-width: 350px;
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease;
    `;
    
    result.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 8px; font-size: 16px;">
        ${title}
      </div>
      <div style="font-size: 14px; line-height: 1.4; opacity: 0.9;">
        ${message}
      </div>
    `;
    
    document.body.appendChild(result);
    
    setTimeout(() => {
      result.style.opacity = '1';
      result.style.transform = 'translateX(0)';
    }, 100);
    
    setTimeout(() => {
      result.style.opacity = '0';
      result.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (result.parentNode) {
          result.parentNode.removeChild(result);
        }
      }, 300);
    }, 6000);
  }

  // Method to show quick tips
  showQuickTips() {
    const tips = [
      "💡 Always select 'Entire Screen' for best audio capture",
      "🔊 Check the 'Share audio' checkbox in the browser dialog",
      "🎵 Computer audio works even if your mic is muted",
      "🔄 If audio doesn't work, stop and restart screen sharing",
      "🌐 Use Chrome or Edge for best compatibility"
    ];

    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    
    const tipNotification = document.createElement('div');
    tipNotification.style.cssText = `
      position: fixed;
      bottom: 100px;
      right: 20px;
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      color: white;
      padding: 12px 16px;
      border-radius: 10px;
      box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
      z-index: 1000;
      max-width: 280px;
      opacity: 0;
      transform: translateY(20px);
      transition: all 0.3s ease;
      font-size: 13px;
      line-height: 1.4;
    `;
    
    tipNotification.textContent = randomTip;
    document.body.appendChild(tipNotification);
    
    setTimeout(() => {
      tipNotification.style.opacity = '1';
      tipNotification.style.transform = 'translateY(0)';
    }, 100);
    
    setTimeout(() => {
      tipNotification.style.opacity = '0';
      tipNotification.style.transform = 'translateY(20px)';
      setTimeout(() => {
        if (tipNotification.parentNode) {
          tipNotification.parentNode.removeChild(tipNotification);
        }
      }, 300);
    }, 5000);
  }
}

// Initialize the helper
const screenShareAudioHelper = new ScreenShareAudioHelper();

// Make it globally accessible
window.screenShareAudioHelper = screenShareAudioHelper;

// Show quick tips periodically during screen sharing
setInterval(() => {
  if (window.enhancedScreenShare && window.enhancedScreenShare.isScreenSharing) {
    const status = window.enhancedScreenShare.getScreenShareStatus();
    if (status.isSharing && !status.hasAudio) {
      screenShareAudioHelper.showQuickTips();
    }
  }
}, 30000); // Show tip every 30 seconds if screen sharing without audio

console.log('Screen Share Audio Helper initialized');