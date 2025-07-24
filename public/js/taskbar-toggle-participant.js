// Taskbar Toggle Functionality
class TaskbarController {
  constructor() {
    this.taskbar = document.querySelector('.taskbar');
    this.videoContainer = document.querySelector('.video-container');
    this.isHidden = false;
    this.isAlwaysShow = true; // Default state from checkbox
    this.mouseNearBottom = false;
    this.toggleCheckbox = null;
    
    this.init();
  }

  init() {
    // Find the specific "Always show meeting controls" toggle checkbox
    this.findToggleCheckbox();
    
    if (this.toggleCheckbox) {
      // Set initial state from checkbox
      this.isAlwaysShow = this.toggleCheckbox.checked;
      
      // Listen for toggle changes
      this.toggleCheckbox.addEventListener('change', (e) => {
        this.isAlwaysShow = e.target.checked;
        console.log('Toggle changed:', this.isAlwaysShow ? 'ON' : 'OFF');
        this.handleToggleChange();
      });
    } else {
      console.warn('Could not find "Always show meeting controls" toggle checkbox');
    }

    // Setup mouse event listeners for auto-hide functionality
    this.setupMouseListeners();
    
    // Setup window resize listener
    this.setupResizeListener();
    
    // Setup initial state
    this.handleToggleChange();
    
    // Set initial video container height and ensure smooth transitions
    this.initializeVideoContainerTransitions();
    this.updateVideoContainerHeight();
  }

  initializeVideoContainerTransitions() {
    if (!this.videoContainer) return;

    // Ensure video container always has smooth transitions
    this.videoContainer.style.transition = 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1), max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), padding 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    
    // Also ensure any child elements that might affect layout have transitions
    const childElements = this.videoContainer.querySelectorAll('.main-video-section, .secondary-videos-section');
    childElements.forEach(element => {
      element.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    });
  }

  findToggleCheckbox() {
    // Method 1: Look for the specific setting item with "Always show meeting controls" text
    const settingItems = document.querySelectorAll('.setting-item');
    
    for (const item of settingItems) {
      const span = item.querySelector('span');
      if (span && span.textContent.trim() === 'Always show meeting controls') {
        this.toggleCheckbox = item.querySelector('input[type="checkbox"]');
        console.log('Found toggle checkbox via setting item');
        return;
      }
    }

    // Method 2: Try to find it by looking for the exact HTML structure
    const toggles = document.querySelectorAll('.toggle input[type="checkbox"]');
    for (const toggle of toggles) {
      const settingItem = toggle.closest('.setting-item');
      if (settingItem) {
        const span = settingItem.querySelector('span');
        if (span && span.textContent.includes('Always show meeting controls')) {
          this.toggleCheckbox = toggle;
          console.log('Found toggle checkbox via toggle structure');
          return;
        }
      }
    }

    // Method 3: Fallback - wait and try again (in case settings modal loads later)
    setTimeout(() => {
      if (!this.toggleCheckbox) {
        this.findToggleCheckbox();
        if (this.toggleCheckbox) {
          this.isAlwaysShow = this.toggleCheckbox.checked;
          this.toggleCheckbox.addEventListener('change', (e) => {
            this.isAlwaysShow = e.target.checked;
            console.log('Toggle changed (delayed):', this.isAlwaysShow ? 'ON' : 'OFF');
            this.handleToggleChange();
          });
          this.handleToggleChange();
        }
      }
    }, 2000);
  }

  setupMouseListeners() {
    // Track mouse position for bottom detection
    document.addEventListener('mousemove', (e) => {
      const windowHeight = window.innerHeight;
      const mouseY = e.clientY;
      
      // Check if mouse is near bottom (within 80px)
      const wasNearBottom = this.mouseNearBottom;
      this.mouseNearBottom = mouseY > windowHeight - 80;
      
      // Handle visibility based on current mode and mouse position
      if (!this.isAlwaysShow) {
        if (this.mouseNearBottom && !wasNearBottom && this.isHidden) {
          // Mouse entered bottom area - show immediately
          this.showTaskbar();
        } else if (!this.mouseNearBottom && wasNearBottom && !this.isHidden && !this.taskbar.matches(':hover')) {
          // Mouse left bottom area - hide immediately
          this.hideTaskbar();
        }
      }
    });

    // Handle mouse leaving the window
    document.addEventListener('mouseleave', () => {
      if (!this.isAlwaysShow) {
        this.mouseNearBottom = false;
        this.hideTaskbar();
      }
    });

    // Prevent hiding when hovering over taskbar
    if (this.taskbar) {
      this.taskbar.addEventListener('mouseenter', () => {
        if (!this.isAlwaysShow) {
          // Keep taskbar visible while hovering
        }
      });

      this.taskbar.addEventListener('mouseleave', () => {
        if (!this.isAlwaysShow && !this.mouseNearBottom) {
          this.hideTaskbar();
        }
      });
    }
  }

  setupResizeListener() {
    // Handle window resize to recalculate video container height
    window.addEventListener('resize', () => {
      // Add a small delay to ensure resize is complete
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => {
        this.updateVideoContainerHeight();
      }, 100);
    });
  }

  handleToggleChange() {
    console.log('Handling toggle change. Always show:', this.isAlwaysShow);
    
    if (this.isAlwaysShow) {
      // Toggle is ON - show taskbar immediately and keep it visible
      this.showTaskbar();
      this.taskbar.classList.remove('auto-hide-mode');
      console.log('Taskbar set to always visible');
    } else {
      // Toggle is OFF - enter auto-hide mode
      this.taskbar.classList.add('auto-hide-mode');
      if (!this.mouseNearBottom) {
        this.hideTaskbar();
        console.log('Taskbar hidden (auto-hide mode)');
      } else {
        console.log('Taskbar visible (mouse near bottom)');
      }
    }
  }

  showTaskbar() {
    if (!this.taskbar) return;
    
    console.log('Showing taskbar');
    this.isHidden = false;
    this.taskbar.style.transform = 'translateY(0)';
    this.taskbar.style.opacity = '1';
    this.taskbar.style.visibility = 'visible';
    
    // Add smooth transition
    this.taskbar.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    
    // Update video container height when taskbar is shown
    this.updateVideoContainerHeight(true);
  }

  hideTaskbar() {
    if (!this.taskbar || this.isAlwaysShow) return;
    
    console.log('Hiding taskbar');
    this.isHidden = true;
    this.taskbar.style.transform = 'translateY(100%)';
    this.taskbar.style.opacity = '0';
    
    // Add smooth transition
    this.taskbar.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    
    // Update video container height when taskbar is hidden
    this.updateVideoContainerHeight(false);
    
    // Keep visibility for smooth animation, then hide after transition
    setTimeout(() => {
      if (this.isHidden) {
        this.taskbar.style.visibility = 'hidden';
      }
    }, 400);
  }

  updateVideoContainerHeight(taskbarVisible = null) {
    if (!this.videoContainer || !this.taskbar) return;

    // Determine if taskbar is currently visible
    let isTaskbarVisible;
    if (taskbarVisible !== null) {
      isTaskbarVisible = taskbarVisible;
    } else {
      // Check current state
      isTaskbarVisible = this.isAlwaysShow || 
        (this.taskbar.style.transform !== 'translateY(100%)' && this.taskbar.style.opacity !== '0');
    }

    // Get taskbar height
    const taskbarHeight = this.taskbar.offsetHeight;
    
    // Calculate available height
    const windowHeight = window.innerHeight;
    const availableHeight = isTaskbarVisible ? 
      windowHeight - taskbarHeight : 
      windowHeight;

    console.log('Updating video container height:', availableHeight + 'px', 'Taskbar visible:', isTaskbarVisible);

    // Ensure smooth transition is always applied
    this.videoContainer.style.transition = 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1), max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    
    // Apply the height to video container
    this.videoContainer.style.height = `${availableHeight}px`;
    this.videoContainer.style.maxHeight = `${availableHeight}px`;
    
    // Also update any layout-affecting properties with transitions
    this.videoContainer.style.minHeight = `${availableHeight}px`;
    
    // Trigger a reflow to ensure smooth animation
    this.videoContainer.offsetHeight;
  }

  // Public method to toggle taskbar visibility
  toggle() {
    if (this.toggleCheckbox) {
      this.toggleCheckbox.checked = !this.toggleCheckbox.checked;
      this.toggleCheckbox.dispatchEvent(new Event('change'));
    }
  }

  // Public method to set always show state
  setAlwaysShow(alwaysShow) {
    if (this.toggleCheckbox) {
      this.toggleCheckbox.checked = alwaysShow;
      this.toggleCheckbox.dispatchEvent(new Event('change'));
    }
  }

  // Public method to get current state
  getState() {
    return {
      isAlwaysShow: this.isAlwaysShow,
      isHidden: this.isHidden,
      mouseNearBottom: this.mouseNearBottom,
      taskbarVisible: !this.isHidden,
      toggleCheckboxFound: !!this.toggleCheckbox
    };
  }

  // Public method to manually trigger video container height update
  refreshVideoContainer() {
    this.updateVideoContainerHeight();
  }
}

// Enhanced CSS for smooth animations
function addTaskbarStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .taskbar {
      position: relative;
      z-index: 100;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      transform: translateY(0);
      opacity: 1;
      visibility: visible;
    }

    /* Auto-hide mode styling */
    .taskbar.auto-hide-mode {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
    }

    /* Hover effect for better UX */
    .taskbar:hover {
      box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
    }

    /* Visual indicator for auto-hide mode */
    .taskbar.auto-hide-mode::before {
      content: '';
      position: absolute;
      top: -2px;
      left: 50%;
      transform: translateX(-50%);
      width: 40px;
      height: 2px;
      background: linear-gradient(90deg, transparent, #3b82f6, transparent);
      border-radius: 1px;
      opacity: 0.6;
      animation: pulse 2s infinite;
    }

    /* Enhanced Video Container Transitions */
    .video-container {
      transition: height 0.4s cubic-bezier(0.4, 0, 0.2, 1), 
                  max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1),
                  min-height 0.4s cubic-bezier(0.4, 0, 0.2, 1),
                  padding 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
      overflow: hidden;
    }

    /* Ensure child elements also have smooth transitions */
    .video-container .main-video-section,
    .video-container .secondary-videos-section {
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* Video wrapper transitions for layout changes */
    .video-wrapper {
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* Participants panel transitions */
    .participants-panel {
      transition: right 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* Smooth transitions for any layout changes */
    .video-container.participants-open {
      transition: padding-right 0.4s cubic-bezier(0.4, 0, 0.2, 1),
                  height 0.4s cubic-bezier(0.4, 0, 0.2, 1),
                  max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
    }

    /* Grid and sidebar view transitions */
    .video-container.grid-view,
    .video-container.sidebar-view {
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }

    @keyframes pulse {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 1; }
    }

    /* Responsive adjustments with smooth transitions */
    @media (max-width: 768px) {
      .taskbar.auto-hide-mode {
        position: fixed;
      }
      
      .video-container {
        transition: height 0.4s cubic-bezier(0.4, 0, 0.2, 1),
                    max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1),
                    flex-direction 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
      }
    }

    /* Ensure all modal and overlay transitions are smooth */
    .modal-overlay,
    .participants-panel,
    .settings-modal {
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }
  `;
  document.head.appendChild(style);
}

// Initialize the taskbar controller when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Add enhanced styles
  addTaskbarStyles();
  
  // Wait a bit for the page to fully load, then initialize
  setTimeout(() => {
    window.taskbarController = new TaskbarController();
  }, 1000);
});

// Also try to initialize when settings modal is opened
document.addEventListener('click', (e) => {
  // Check if settings button was clicked
  if (e.target.closest('#settings-btn') || e.target.closest('[data-tab]')) {
    setTimeout(() => {
      if (window.taskbarController && !window.taskbarController.toggleCheckbox) {
        window.taskbarController.findToggleCheckbox();
      }
    }, 500);
  }
});

// Also try to initialize when the window loads (backup)
window.addEventListener('load', () => {
  if (!window.taskbarController) {
    setTimeout(() => {
      window.taskbarController = new TaskbarController();
    }, 500);
  }
});

// Keyboard shortcut to toggle taskbar (Ctrl + H)
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'h' && window.taskbarController) {
    e.preventDefault();
    window.taskbarController.toggle();
  }
});

// Listen for any layout changes that might affect video container
window.addEventListener('resize', () => {
  if (window.taskbarController) {
    window.taskbarController.refreshVideoContainer();
  }
});

// Export for global access
window.TaskbarController = TaskbarController;