// Permission Notifications System
class PermissionNotifications {
  constructor() {
    this.setupNotificationContainer();
  }

  setupNotificationContainer() {
    if (!document.getElementById('permission-notifications')) {
      const container = document.createElement('div');
      container.id = 'permission-notifications';
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
      `;
      document.body.appendChild(container);
    }
  }

  showPermissionNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      background: ${type === 'warning' ? '#ff9800' : type === 'error' ? '#f44336' : '#2196f3'};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-size: 14px;
      font-weight: 500;
      max-width: 300px;
      word-wrap: break-word;
      pointer-events: auto;
      transform: translateX(100%);
      transition: transform 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    `;

    const icon = type === 'warning' ? '⚠️' : type === 'error' ? '❌' : 'ℹ️';
    notification.innerHTML = `<span>${icon}</span><span>${message}</span>`;

    const container = document.getElementById('permission-notifications');
    container.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);

    // Auto remove after 5 seconds
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 5000);
  }

  showChatDisabled() {
    this.showPermissionNotification('Chat has been disabled by the host', 'warning');
  }

  showChatEnabled() {
    this.showPermissionNotification('Chat has been enabled by the host', 'info');
  }

  showFileShareDisabled() {
    this.showPermissionNotification('File sharing has been disabled by the host', 'warning');
  }

  showFileShareEnabled() {
    this.showPermissionNotification('File sharing has been enabled by the host', 'info');
  }

  showEmojiReactionsDisabled() {
    this.showPermissionNotification('Emoji reactions have been disabled by the host', 'warning');
  }

  showEmojiReactionsEnabled() {
    this.showPermissionNotification('Emoji reactions have been enabled by the host', 'info');
  }
}

// Initialize global permission notifications
window.permissionNotifications = new PermissionNotifications();