
// Global variable to track hand raising status
let handRaisingEnabled = true;

// Force alert function that will definitely show
function forceHandRaisingDisabledAlert() {

  // Backup notification methods
  if (typeof Swal !== 'undefined') {
    Swal.fire('Hand Raising disabled:');
  }
  
  // Console log as backup
  console.warn('ALERT: Hand Raising disabled:');
  
  // Create a custom modal as ultimate backup
  showCustomAlert('Hand Raising disabled:');
}

// Custom alert modal as backup
function showCustomAlert(message) {
  // Remove existing alert if any
  const existingAlert = document.getElementById('custom-hand-alert');
  if (existingAlert) {
    existingAlert.remove();
  }

  // Create custom alert modal
const alertDiv = document.createElement('div');
alertDiv.id = 'custom-hand-alert';
alertDiv.style.cssText = `
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(10px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  animation: fadeIn 0.3s ease-out;
`;

alertDiv.innerHTML = `
  <style>
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideIn {
      from { transform: translate(-50%, -60%) scale(0.9); opacity: 0; }
      to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    #hand-alert-modal {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 20px;
      padding: 40px 35px;
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
      text-align: center;
      min-width: 380px;
      max-width: 450px;
      animation: slideIn 0.4s ease-out;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    #hand-alert-modal::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
      border-radius: 20px;
      pointer-events: none;
    }
    .alert-icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 25px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
      color: #ffffff;
      animation: pulse 2s infinite;
      border: 2px solid rgba(255, 255, 255, 0.3);
    }
    .alert-title {
      color: #ffffff;
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 15px;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }
    .alert-message {
      color: rgba(255, 255, 255, 0.9);
      font-size: 16px;
      line-height: 1.5;
      margin-bottom: 30px;
      font-weight: 400;
    }
    .alert-button {
      background: linear-gradient(135deg, #ff6b6b, #ee5a24);
      color: white;
      border: none;
      padding: 14px 35px;
      border-radius: 50px;
      cursor: pointer;
      font-size: 16px;
      font-weight: 600;
      transition: all 0.3s ease;
      box-shadow: 0 8px 20px rgba(255, 107, 107, 0.4);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .alert-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 25px rgba(255, 107, 107, 0.5);
      background: linear-gradient(135deg, #ff5252, #d63031);
    }
    .alert-button:active {
      transform: translateY(0);
      box-shadow: 0 6px 15px rgba(255, 107, 107, 0.3);
    }
  </style>
  <div id="hand-alert-modal">
    <div class="alert-icon">
      <i class="fas fa-hand-paper"></i>
    </div>
    <div class="alert-title">Hand Raising Disabled</div>
    <div class="alert-message">
      The meeting host has disabled the hand raising feature for participants.
    </div>
    <button class="alert-button" onclick="document.getElementById('custom-hand-alert').remove()">
      <i class="fas fa-check" style="margin-right: 8px;"></i>Got It
    </button>
  </div>
`;

// Add FontAwesome if not already loaded
if (!document.querySelector('link[href*="font-awesome"]') && !document.querySelector('script[src*="font-awesome"]')) {
  const fontAwesome = document.createElement('link');
  fontAwesome.rel = 'stylesheet';
  fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
  document.head.appendChild(fontAwesome);
}
  
  document.body.appendChild(alertDiv);
  
  // Auto remove after 20 seconds
  setTimeout(() => {
    if (document.getElementById('custom-hand-alert')) {
      document.getElementById('custom-hand-alert').remove();
    }
  }, 20000);
}

function toggleHandRaising() {
  handRaisingEnabled = !handRaisingEnabled;
  
  // Find the raise hand button
  const raiseHandBtn = document.getElementById('rm-raiseHandBtn');
  
  if (raiseHandBtn) {
    if (handRaisingEnabled) {
      // Enable hand raising - COMPLETELY restore original functionality
      raiseHandBtn.disabled = false;
      raiseHandBtn.style.opacity = '1';
      raiseHandBtn.style.cursor = 'pointer';
      raiseHandBtn.title = 'Raise Hand';
      
      // Remove our custom attribute that marks interception
      raiseHandBtn.removeAttribute('data-permission-intercepted');
      
      // Restore original event listeners if we have a reference to the ReactionManager
      if (window.reactionManager && window.reactionManager.boundHandlers) {
        // Remove our intercepting listeners and restore original ones
        restoreOriginalEventListeners(raiseHandBtn);
      }
      
      console.log('Hand raising enabled - original functionality restored');
    } else {
      // Disable hand raising - FORCE LOWER ALL RAISED HANDS IMMEDIATELY
      raiseHandBtn.disabled = true;
      raiseHandBtn.style.opacity = '0.5';
      raiseHandBtn.style.cursor = 'not-allowed';
      raiseHandBtn.title = 'Hand raising disabled by meeting host';
      
      // Force lower all raised hands immediately
      forceAllHandsDown();
      
      // Apply permission interception
      applyPermissionInterception(raiseHandBtn);
      
      console.log('Hand raising disabled - all raised hands lowered');
    }
  }
  
  return handRaisingEnabled;
}

// Force all raised hands down immediately
function forceAllHandsDown() {
  // Method 1: Force lower the current user's hand
  const raiseHandBtn = document.getElementById('rm-raiseHandBtn');
  if (raiseHandBtn && raiseHandBtn.getAttribute('data-active') === 'true') {
    // Use ReactionManager if available
    if (window.reactionManager && typeof window.reactionManager.lowerHand === 'function') {
      window.reactionManager.lowerHand();
    } else {
      // Fallback: manually update button state
      raiseHandBtn.setAttribute('data-active', 'false');
      raiseHandBtn.classList.remove('rm-active');
    }
  }

  // Method 2: Clear all raised hands from ReactionManager's internal state
  if (window.reactionManager && window.reactionManager.raisedHands) {
    // Clear the raised hands set
    window.reactionManager.raisedHands.clear();
    // Update participants display to remove all hand indicators
    if (typeof window.reactionManager.updateParticipantsDisplay === 'function') {
      window.reactionManager.updateParticipantsDisplay();
    }
  }

  // Method 3: Force remove all visual hand indicators from DOM
  forceRemoveAllHandIndicators();

  // Method 4: Emit socket event to force all participants to lower hands
  if (window.reactionManager && window.reactionManager.socket) {
    // If this is the host/admin, broadcast to all participants
    window.reactionManager.socket.emit('force-all-hands-down', {
      reason: 'Hand raising disabled by host',
      timestamp: Date.now()
    });
  }

  // Method 5: Also send individual lower-hand event for current user
  if (window.reactionManager && window.reactionManager.socket) {
    window.reactionManager.socket.emit('lower-hand', {
      forced: true,
      reason: 'Hand raising disabled',
      timestamp: Date.now()
    });
  }
}

// Force remove all visual hand indicators from the UI
function forceRemoveAllHandIndicators() {
  // Remove hand raised icons from participant list
  const handIcons = document.querySelectorAll('.rm-hand-raised-icon');
  handIcons.forEach(icon => icon.remove());

  // Remove hand raised indicators from video wrappers
  const handIndicators = document.querySelectorAll('.rm-hand-raised-indicator');
  handIndicators.forEach(indicator => indicator.remove());

  // Reset any participant items with hand status
  const participantItems = document.querySelectorAll('.participant-item[data-socket-id]');
  participantItems.forEach(item => {
    const statusIcons = item.querySelectorAll('.status-icon.rm-hand-raised-icon');
    statusIcons.forEach(icon => icon.remove());
  });

  // Reset video wrapper hand indicators
  const videoWrappers = document.querySelectorAll('.video-wrapper[data-socket-id]');
  videoWrappers.forEach(wrapper => {
    const indicators = wrapper.querySelectorAll('.rm-hand-raised-indicator');
    indicators.forEach(indicator => indicator.remove());
  });
}

// Enhanced socket listener setup for force-hands-down events
function setupForceHandsDownListener() {
  // Wait for ReactionManager to be available
  const checkForReactionManager = () => {
    if (window.reactionManager && window.reactionManager.socket) {
      // Add listener for forced hand lowering from host
      window.reactionManager.socket.on('force-all-hands-down', (data) => {
        console.log('Force all hands down received:', data.reason);
        
        // Force lower current user's hand
        const raiseHandBtn = document.getElementById('rm-raiseHandBtn');
        if (raiseHandBtn && raiseHandBtn.getAttribute('data-active') === 'true') {
          if (typeof window.reactionManager.lowerHand === 'function') {
            window.reactionManager.lowerHand();
          }
        }

        // Clear all raised hands from internal state
        if (window.reactionManager.raisedHands) {
          window.reactionManager.raisedHands.clear();
        }

        // Remove all visual indicators
        forceRemoveAllHandIndicators();

        // Update display
        if (typeof window.reactionManager.updateParticipantsDisplay === 'function') {
          window.reactionManager.updateParticipantsDisplay();
        }

        // Show notification
        if (typeof window.reactionManager.showToast === 'function') {
          window.reactionManager.showToast('All hands have been lowered by the host', 'info');
        }
      });

      console.log('Force hands down listener setup complete');
    } else {
      // Retry after a short delay
      setTimeout(checkForReactionManager, 500);
    }
  };

  checkForReactionManager();
}

// Store references to original event listeners
let originalEventListeners = new Map();

// Function to store original event listeners before intercepting
function storeOriginalEventListeners(button) {
  if (!button || originalEventListeners.has(button)) return;
  
  // Clone the button to get a clean version without our interceptors
  const cleanButton = button.cloneNode(true);
  originalEventListeners.set(button, {
    element: cleanButton,
    reactionManager: window.reactionManager
  });
}

// Function to restore original event listeners
function restoreOriginalEventListeners(button) {
  if (!button || !originalEventListeners.has(button)) return;
  
  const stored = originalEventListeners.get(button);
  if (stored && stored.reactionManager && stored.reactionManager.boundHandlers) {
    // Remove all our custom listeners
    button.removeEventListener('click', interceptClick, true);
    button.removeEventListener('mousedown', interceptInteraction, true);
    button.removeEventListener('touchstart', interceptInteraction, true);
    button.removeEventListener('pointerdown', interceptInteraction, true);
    
    // Re-attach original ReactionManager listeners if they exist
    if (stored.reactionManager.boundHandlers.raiseHandClick) {
      button.addEventListener('click', stored.reactionManager.boundHandlers.raiseHandClick);
    }
  }
}

// Interceptor functions (only used when disabled)
function interceptClick(e) {
  if (!handRaisingEnabled) {
    e.preventDefault();
    e.stopImmediatePropagation();
    e.stopPropagation();
    forceHandRaisingDisabledAlert();
    return false;
  }
}

function interceptInteraction(e) {
  if (!handRaisingEnabled) {
    e.preventDefault();
    e.stopImmediatePropagation();
    e.stopPropagation();
    forceHandRaisingDisabledAlert();
    return false;
  }
}

// Apply permission interception ONLY when disabled
function applyPermissionInterception(button) {
  if (!button || button.hasAttribute('data-permission-intercepted')) return;
  
  // Store original listeners before intercepting
  storeOriginalEventListeners(button);
  
  // Mark as intercepted
  button.setAttribute('data-permission-intercepted', 'true');
  
  // Add intercepting listeners with highest priority (capture phase)
  button.addEventListener('click', interceptClick, true);
  button.addEventListener('mousedown', interceptInteraction, true);
  button.addEventListener('touchstart', interceptInteraction, true);
  button.addEventListener('pointerdown', interceptInteraction, true);
}

// Remove permission interception
function removePermissionInterception(button) {
  if (!button || !button.hasAttribute('data-permission-intercepted')) return;
  
  button.removeAttribute('data-permission-intercepted');
  
  // Remove intercepting listeners
  button.removeEventListener('click', interceptClick, true);
  button.removeEventListener('mousedown', interceptInteraction, true);
  button.removeEventListener('touchstart', interceptInteraction, true);
  button.removeEventListener('pointerdown', interceptInteraction, true);
  
  // Restore original listeners
  restoreOriginalEventListeners(button);
}

// REMOVED: The aggressive interceptRaiseHandClicks function that was interfering

// REMOVED: The enhancedHandleRaiseHandClick wrapper that was overriding methods

// REMOVED: The patchReactionManagerForToggle function that was modifying instances

// Lightweight monitoring that only acts when permission is disabled
function startHandRaisingMonitor() {
  // Only monitor for applying restrictions when disabled
  const observer = new MutationObserver(() => {
    // Only apply interception if hand raising is currently disabled
    if (!handRaisingEnabled) {
      const btn = document.getElementById('rm-raiseHandBtn');
      if (btn && !btn.hasAttribute('data-permission-intercepted')) {
        applyPermissionInterception(btn);
      }
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Periodic check only when disabled
  setInterval(() => {
    if (!handRaisingEnabled) {
      const btn = document.getElementById('rm-raiseHandBtn');
      if (btn && !btn.hasAttribute('data-permission-intercepted')) {
        applyPermissionInterception(btn);
      }
    }
  }, 2000);
}

// Public API for external control
window.handRaisingPermissions = {
  toggle: toggleHandRaising,
  enable: function() {
    if (!handRaisingEnabled) {
      return toggleHandRaising();
    }
    return true;
  },
  disable: function() {
    if (handRaisingEnabled) {
      return toggleHandRaising();
    }
    return false;
  },
  isEnabled: function() {
    return handRaisingEnabled;
  },
  showAlert: forceHandRaisingDisabledAlert,
  forceAllHandsDown: forceAllHandsDown // Exposed for manual use
};

// Usage examples:

// Example 1: Basic toggle (call this to enable/disable)
// toggleHandRaising();

// Example 2: Using the public API
// window.handRaisingPermissions.disable();
// window.handRaisingPermissions.enable();

// Example 3: Check status
// console.log('Hand raising enabled:', window.handRaisingPermissions.isEnabled());

// Example 4: Force test the alert
// window.handRaisingPermissions.showAlert();

// Auto-start lightweight monitoring and setup when script loads
document.addEventListener('DOMContentLoaded', () => {
  startHandRaisingMonitor();
  setupForceHandsDownListener();
});
if (document.readyState !== 'loading') {
  startHandRaisingMonitor();
  setupForceHandsDownListener();
}
// Add these functions to your existing code

/**
 * Enable hand raising functionality
 * @returns {boolean} - true if hand raising is now enabled
 */


/**
 * Beautiful toast notification system
 */
// Track hand raising status toast to prevent multiple notifications
let handRaisingToastId = null;


// Function to remove toast with animation
function removeToast(toastId) {
  const toast = document.getElementById(toastId);
  if (toast) {
    toast.style.animation = 'toastSlideOut 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards';
    setTimeout(() => {
      if (toast && toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 400);
  }
}

// Make removeToast globally accessible
window.removeToast = removeToast;

/**
 * Convenience functions for different toast types
 */
function showSuccessToast(message, duration = 5000, replaceId = null) {
  return showToast(message, 'success', duration, replaceId);
}

function showErrorToast(message, duration = 7000, replaceId = null) {
  return showToast(message, 'error', duration, replaceId);
}

function showWarningToast(message, duration = 6000, replaceId = null) {
  return showToast(message, 'warning', duration, replaceId);
}

function showInfoToast(message, duration = 5000, replaceId = null) {
  return showToast(message, 'info', duration, replaceId);
}

// Update the public API to include the new functions
window.handRaisingPermissions = {
  toggle: toggleHandRaising,
  enable: enableHandRaising,        // New dedicated enable function
  disable: disableHandRaising,      // New dedicated disable function
  isEnabled: function() {
    return handRaisingEnabled;
  },
  showAlert: forceHandRaisingDisabledAlert,
  forceAllHandsDown: forceAllHandsDown
};

// Usage Examples:
/*

// Enable hand raising with beautiful toast
enableHandRaising();

// Disable hand raising with beautiful toast
disableHandRaising();

// Or use the public API
window.handRaisingPermissions.enable();
window.handRaisingPermissions.disable();

// Show custom toast notifications
showSuccessToast('✨ Meeting started successfully!');
showErrorToast('❌ Connection failed. Please try again.');
showWarningToast('⚠️ Please mute your microphone.');
showInfoToast('ℹ️ New participant joined the meeting.');

// Check current status
console.log('Hand raising enabled:', window.handRaisingPermissions.isEnabled());

*/