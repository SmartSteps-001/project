   // Standalone script to set meeting ID in input field
// This should be added AFTER your existing HostMeeting initialization

// Wait for the page and HostMeeting to be fully loaded
window.addEventListener('load', function() {
  // Function to set meeting ID and add copy functionality
  function setupMeetingIdInput() {
    const meetingIdInput = document.querySelector('.id-display .text-input');
    const copyBtn = document.querySelector('.id-display .copy-btn');
    
    // Check if elements exist and hostMeetingInstance is available
    if (meetingIdInput && window.hostMeetingInstance) {
      // Set the meeting ID value
      meetingIdInput.value = window.hostMeetingInstance.meetingId;
      
      // Add copy functionality to the button
      if (copyBtn) {
        // Remove any existing click listeners to avoid duplicates
        copyBtn.replaceWith(copyBtn.cloneNode(true));
        const newCopyBtn = document.querySelector('.id-display .copy-btn');
        
        newCopyBtn.addEventListener('click', function() {
          navigator.clipboard.writeText(window.hostMeetingInstance.meetingId).then(function() {
            // Use the existing showToast method if available
            if (window.hostMeetingInstance && window.hostMeetingInstance.showToast) {
              window.hostMeetingInstance.showToast('Meeting ID copied to clipboard!');
            } else {
              // Fallback notification
              alert('Meeting ID copied to clipboard!');
            }
          }).catch(function() {
            // Error handling
            if (window.hostMeetingInstance && window.hostMeetingInstance.showToast) {
              window.hostMeetingInstance.showToast('Failed to copy Meeting ID', 'error');
            } else {
              // Fallback error notification
              alert('Failed to copy Meeting ID');
            }
          });
        });
      }
    } else {
      // If not ready yet, try again after a short delay
      setTimeout(setupMeetingIdInput, 500);
    }
  }
  
  // Start trying to setup the input after a delay
  setTimeout(setupMeetingIdInput, 2000);
});

// Alternative approach using MutationObserver to watch for changes
// Uncomment this if the above doesn't work reliably
/*
function observeForMeetingInstance() {
  let attempts = 0;
  const maxAttempts = 20; // Maximum 10 seconds (20 * 500ms)
  
  const checkInterval = setInterval(function() {
    attempts++;
    
    if (window.hostMeetingInstance && window.hostMeetingInstance.meetingId) {
      // HostMeeting is ready, set up the input
      const meetingIdInput = document.querySelector('.id-display .text-input');
      const copyBtn = document.querySelector('.id-display .copy-btn');
      
      if (meetingIdInput) {
        meetingIdInput.value = window.hostMeetingInstance.meetingId;
        
        if (copyBtn) {
          copyBtn.onclick = function() {
            navigator.clipboard.writeText(window.hostMeetingInstance.meetingId).then(function() {
              if (window.hostMeetingInstance.showToast) {
                window.hostMeetingInstance.showToast('Meeting ID copied to clipboard!');
              }
            }).catch(function() {
              if (window.hostMeetingInstance.showToast) {
                window.hostMeetingInstance.showToast('Failed to copy Meeting ID', 'error');
              }
            });
          };
        }
      }
      
      clearInterval(checkInterval);
    } else if (attempts >= maxAttempts) {
      console.warn('HostMeeting instance not found after maximum attempts');
      clearInterval(checkInterval);
    }
  }, 500);
}

// Use this alternative approach if needed
// observeForMeetingInstance();
*/