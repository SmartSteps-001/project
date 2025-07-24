// Taskbar Toggle Functionality
class TaskbarController {
  constructor() {
    this.taskbar = document.querySelector('.taskbar');
    this.isHidden = false;
    this.isAlwaysShow = true; // Default state from checkbox
    this.mouseNearBottom = false;
    
    this.init();
  }

  init() {
    // Find the toggle checkbox in settings - specifically the "Always show meeting controls" toggle
    const alwaysShowToggle = document.querySelector('.setting-item input[type="checkbox"]');
    
    if (alwaysShowToggle) {
      // Set initial state
      this.isAlwaysShow = alwaysShowToggle.checked;
      
      // Listen for toggle changes
      alwaysShowToggle.addEventListener('change', (e) => {
        this.isAlwaysShow = e.target.checked;
        this.handleToggleChange();
      });
    }

    // Setup mouse event listeners for auto-hide functionality
    this.setupMouseListeners();
    
    // Setup initial state
    this.handleToggleChange();
  }

  setupMouseListeners() {
    // Track mouse position for bottom detection
    document.addEventListener('mousemove', (e) => {
      const windowHeight = window.innerHeight;
      const mouseY = e.clientY;
      
      // Check if mouse is near bottom (within 80px)
      this.mouseNearBottom = mouseY > windowHeight - 80;
      
      // Handle visibility based on current mode and mouse position
      if (!this.isAlwaysShow) {
        if (this.mouseNearBottom && this.isHidden) {
          this.showTaskbar();
        } else if (!this.mouseNearBottom && !this.isHidden && !this.taskbar.matches(':hover')) {
          this.hideTaskbar();
        }
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

  handleToggleChange() {
    if (this.isAlwaysShow) {
      // Toggle is ON - show taskbar immediately and keep it visible
      this.showTaskbar();
      this.taskbar.classList.remove('auto-hide-mode');
    } else {
      // Toggle is OFF - hide taskbar immediately unless mouse is near bottom
      this.taskbar.classList.add('auto-hide-mode');
      if (!this.mouseNearBottom) {
        this.hideTaskbar();
      }
    }
  }

  showTaskbar() {
    if (!this.taskbar) return;
    
    this.isHidden = false;
    this.taskbar.style.transform = 'translateY(0)';
    this.taskbar.style.opacity = '1';
    this.taskbar.style.visibility = 'visible';
    
    // Add smooth transition
    this.taskbar.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
  }

  hideTaskbar() {
    if (!this.taskbar || this.isAlwaysShow) return;
    
    this.isHidden = true;
    this.taskbar.style.transform = 'translateY(100%)';
    this.taskbar.style.opacity = '0';
    
    // Add smooth transition
    this.taskbar.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    
    // Keep visibility for smooth animation, then hide after transition
    setTimeout(() => {
      if (this.isHidden) {
        this.taskbar.style.visibility = 'hidden';
      }
    }, 300);
  }

  // Public method to toggle taskbar visibility
  toggle() {
    if (this.isHidden) {
      this.showTaskbar();
    } else if (!this.isAlwaysShow) {
      this.hideTaskbar();
    }
  }

  // Public method to set always show state
  setAlwaysShow(alwaysShow) {
    this.isAlwaysShow = alwaysShow;
    this.handleToggleChange();
  }
}

// Enhanced CSS for smooth animations
function addTaskbarStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .taskbar {
      position: relative;
      z-index: 100;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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

    @keyframes pulse {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 1; }
    }

    /* Responsive adjustments */
    @media (max-width: 768px) {
      .taskbar.auto-hide-mode {
        position: fixed;
      }
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

// Export for global access
window.TaskbarController = TaskbarController;