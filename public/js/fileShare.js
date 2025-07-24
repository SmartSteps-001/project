document.addEventListener('DOMContentLoaded', function() {
    // Global state
    let fileSharingEnabled = true;
    let currentGroupId = null;
    let files = [];
    let groups = [];
    
    // DOM elements - consolidated and properly referenced
    const shareBtn = document.getElementById('floating-share-btn');
    const statusIndicator = document.getElementById('statusIndicator');
    const shareModal = document.getElementById('shareModal');
    const disabledModal = document.getElementById('disabledModal');
    const modal = document.getElementById('file-sharing-modal');
    const closeBtn = document.getElementById('close-modal-btn');
    const fileInput = document.getElementById('file-input');
    const fileSelected = document.getElementById('file-selected');
    const uploadForm = document.getElementById('upload-form');
    const filesList = document.getElementById('files-list');
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const groupList = document.getElementById('group-list');
    const createGroupBtn = document.getElementById('create-group-btn');
    const createGroupModal = document.getElementById('create-group-modal');
    const closeGroupModalBtn = document.getElementById('close-group-modal-btn');
    const createGroupForm = document.getElementById('create-group-form');
    const currentGroupName = document.getElementById('current-group-name');
    const loadingSpinner = document.getElementById('loading-spinner');
    
    // API endpoints
    const API_URL = '/api';
    const ENDPOINTS = {
        FILES: `${API_URL}/files`,
        GROUPS: `${API_URL}/groups`,
        FILE_SHARING_STATUS: `${API_URL}/file-sharing-status`
    };

    // Initialize the app
    initApp();

    // Event listeners
    if (shareBtn) {
        shareBtn.addEventListener('click', () => handleToolClick('share'));
    }
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelection);
    }
    
    if (uploadForm) {
        uploadForm.addEventListener('submit', uploadFiles);
    }
    
    if (searchBtn) {
        searchBtn.addEventListener('click', searchFiles);
    }
    
    if (searchInput) {
        searchInput.addEventListener('keyup', function(e) {
            if (e.key === 'Enter') searchFiles();
        });
    }
    
    if (createGroupBtn) {
        createGroupBtn.addEventListener('click', openCreateGroupModal);
    }
    
    if (closeGroupModalBtn) {
        closeGroupModalBtn.addEventListener('click', closeCreateGroupModal);
    }
    
    if (createGroupForm) {
        createGroupForm.addEventListener('submit', createGroup);
    }

    // Window event listeners
    window.addEventListener('load', async () => {
        await checkFileSharingStatus();
    });
    
    window.addEventListener('click', outsideClick);
    
    // Check file sharing status every 2 seconds
    setInterval(checkFileSharingStatus, 2000);

    // File sharing status functions
    async function checkFileSharingStatus() {
        try {
            const response = await fetch(ENDPOINTS.FILE_SHARING_STATUS);
            const data = await response.json();
            
            fileSharingEnabled = data.enabled;
            updateShareButton();
            updateStatusIndicator();
        } catch (error) {
            console.error('Error checking file sharing status:', error);
        }
    }
    
    function updateShareButton() {
        if (shareBtn) {
            if (fileSharingEnabled) {
                shareBtn.classList.remove('disabled');
            } else {
                shareBtn.classList.add('disabled');
            }
        }
    }
    
    function updateStatusIndicator() {
        if (statusIndicator) {
            statusIndicator.textContent = `File sharing is currently ${fileSharingEnabled ? 'enabled' : 'disabled'}`;
            statusIndicator.className = `status-indicator ${fileSharingEnabled ? 'status-enabled' : 'status-disabled'}`;
        }
    }

    // Tool click handler
    function handleToolClick(tool) {
        if (tool === 'share') {
            if (!fileSharingEnabled) {
                showDisabledModal();
                return;
            }
            openModal();
        } else {
            alert(`${tool} tool clicked!`);
        }
    }

    // Modal functions
    function openModal() {
        // Security check: Even if someone tries to call this directly, check the status
        if (!fileSharingEnabled) {
            console.warn('File sharing is disabled. Cannot open share modal.');
            showDisabledModal();
            return;
        }
        
        // Use the correct modal reference
        const targetModal = modal || shareModal;
        if (targetModal) {
            targetModal.style.display = 'flex';
            refreshFilesList();
        }
    }
    
    function closeModal() {
        if (modal) {
            modal.style.display = 'none';
        }
        if (shareModal) {
            shareModal.style.display = 'none';
        }
    }
    
    function showDisabledModal() {
        if (disabledModal) {
            disabledModal.style.display = 'block';
        }
    }
    
    function closeDisabledModal() {
        if (disabledModal) {
            disabledModal.style.display = 'none';
        }
    }

    // Navigation functions
    function goToHostPage() {
        window.location.href = 'meetingHost.html';
    }

    // Outside click handler
    function outsideClick(e) {
        if (modal && e.target === modal) {
            closeModal();
        }
        if (shareModal && e.target === shareModal) {
            closeModal();
        }
        if (createGroupModal && e.target === createGroupModal) {
            closeCreateGroupModal();
        }
        if (disabledModal && e.target === disabledModal) {
            closeDisabledModal();
        }
    }

    // Group modal functions
    function openCreateGroupModal() {
        if (createGroupModal) {
            createGroupModal.style.display = 'flex';
        }
    }

    function closeCreateGroupModal() {
        if (createGroupModal) {
            createGroupModal.style.display = 'none';
        }
    }

    // File selection handler
    function handleFileSelection() {
        if (fileInput && fileSelected) {
            if (fileInput.files.length > 0) {
                fileSelected.textContent = `${fileInput.files.length} file(s) selected`;
            } else {
                fileSelected.textContent = 'No files selected';
            }
        }
    }

    // Initialize the application
    async function initApp() {
        await loadGroups();
        await refreshFilesList();
    }

    // Load user groups
    async function loadGroups() {
        try {
            const response = await fetch(ENDPOINTS.GROUPS);
            if (!response.ok) throw new Error('Failed to load groups');
            
            groups = await response.json();
            renderGroups();
        } catch (error) {
            showNotification('Error loading groups', 'error');
            console.error('Error loading groups:', error);
        }
    }

    // Render groups in the sidebar
    function renderGroups() {
        if (!groupList) return;
        
        groupList.innerHTML = `
            <div class="group-item ${!currentGroupId ? 'active' : ''}" data-id="null">
                <i class="fas fa-folder"></i>
                <span>All Files</span>
            </div>
        `;

        groups.forEach(group => {
            const groupItem = document.createElement('div');
            groupItem.className = `group-item ${currentGroupId === group.id ? 'active' : ''}`;
            groupItem.dataset.id = group.id;
            groupItem.innerHTML = `
                <i class="fas fa-folder"></i>
                <span>${group.name}</span>
            `;
            groupList.appendChild(groupItem);
        });

        // Add event listeners to group items
        document.querySelectorAll('.group-item').forEach(item => {
            item.addEventListener('click', () => {
                currentGroupId = item.dataset.id === 'null' ? null : item.dataset.id;
                document.querySelectorAll('.group-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                
                if (currentGroupName) {
                    currentGroupName.textContent = item.dataset.id === 'null' ? 'All Files' : 
                        groups.find(g => g.id === currentGroupId)?.name || 'All Files';
                }
                refreshFilesList();
            });
        });
    }

    // Create a new group
    async function createGroup(e) {
        e.preventDefault();
        
        const groupNameInput = document.getElementById('group-name');
        const descriptionInput = document.getElementById('group-description');
        
        if (!groupNameInput) {
            showNotification('Group name input not found', 'error');
            return;
        }
        
        const groupName = groupNameInput.value;
        const description = descriptionInput ? descriptionInput.value : '';

        if (!groupName.trim()) {
            showNotification('Group name is required', 'error');
            return;
        }

        try {
            const response = await fetch(ENDPOINTS.GROUPS, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: groupName,
                    description: description
                })
            });

            if (!response.ok) throw new Error('Failed to create group');
            
            const newGroup = await response.json();
            groups.push(newGroup);
            renderGroups();
            closeCreateGroupModal();
            
            // Select the newly created group
            currentGroupId = newGroup.id;
            if (currentGroupName) {
                currentGroupName.textContent = newGroup.name;
            }
            refreshFilesList();
            
            // Reset form
            if (createGroupForm) {
                createGroupForm.reset();
            }
            showNotification('Group created successfully', 'success');
        } catch (error) {
            showNotification('Error creating group', 'error');
            console.error('Error creating group:', error);
        }
    }

    // Upload files with progress tracking
    async function uploadFiles(e) {
        e.preventDefault();
        
        if (!fileInput || fileInput.files.length === 0) {
            showNotification('Please select files to upload', 'error');
            return;
        }

        const formData = new FormData();
        for (const file of fileInput.files) {
            formData.append('files', file);
        }
        
        if (currentGroupId) {
            formData.append('groupId', currentGroupId);
        }

        // Create upload progress notification
        const progressNotification = document.createElement('div');
        progressNotification.className = 'notification info';
        progressNotification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-cloud-upload-alt"></i>
                <span>Uploading files: 0%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width:0%"></div>
            </div>
        `;
        document.body.appendChild(progressNotification);
        
        try {
            const xhr = new XMLHttpRequest();
            
            xhr.open('POST', ENDPOINTS.FILES, true);
            
            // Track upload progress
            xhr.upload.onprogress = function(e) {
                if (e.lengthComputable) {
                    const percentComplete = Math.round((e.loaded / e.total) * 100);
                    const spanElement = progressNotification.querySelector('span');
                    const progressFill = progressNotification.querySelector('.progress-fill');
                    
                    if (spanElement) {
                        spanElement.textContent = `Uploading files: ${percentComplete}%`;
                    }
                    if (progressFill) {
                        progressFill.style.width = `${percentComplete}%`;
                    }
                }
            };
            
            // Handle completion
            xhr.onload = function() {
                if (document.body.contains(progressNotification)) {
                    document.body.removeChild(progressNotification);
                }
                
                if (xhr.status >= 200 && xhr.status < 300) {
                    showNotification('Files uploaded successfully!', 'success');
                    if (fileInput) {
                        fileInput.value = '';
                    }
                    if (fileSelected) {
                        fileSelected.textContent = 'No files selected';
                    }
                    refreshFilesList();
                } else {
                    let errorMsg = 'Failed to upload files';
                    try {
                        const response = JSON.parse(xhr.responseText);
                        if (response.error) errorMsg = response.error;
                        if (response.details) errorMsg += `: ${response.details}`;
                    } catch (e) {
                        // Ignore JSON parsing errors
                    }
                    showNotification(errorMsg, 'error');
                }
            };
            
            // Handle upload error
            xhr.onerror = function() {
                if (document.body.contains(progressNotification)) {
                    document.body.removeChild(progressNotification);
                }
                showNotification('Network error during upload', 'error');
            };
            
            xhr.send(formData);
        } catch (error) {
            if (document.body.contains(progressNotification)) {
                document.body.removeChild(progressNotification);
            }
            showNotification(`Error uploading files: ${error.message}`, 'error');
            console.error('Error uploading files:', error);
        }
    }

    // Refresh files list
    async function refreshFilesList() {
        if (loadingSpinner) {
            loadingSpinner.style.display = 'block';
        }
        
        if (filesList) {
            filesList.innerHTML = '';
        }
        
        try {
            let url = ENDPOINTS.FILES;
            if (currentGroupId) {
                url += `?groupId=${currentGroupId}`;
            }
            
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch files');
            
            files = await response.json();
            renderFiles(files);
        } catch (error) {
            showNotification('Error loading files', 'error');
            console.error('Error loading files:', error);
        } finally {
            if (loadingSpinner) {
                loadingSpinner.style.display = 'none';
            }
        }
    }

    // Render files list
    function renderFiles(filesToRender) {
        if (!filesList) return;
        
        if (filesToRender.length === 0) {
            filesList.innerHTML = '<div class="no-files">No files found</div>';
            return;
        }

        filesList.innerHTML = '';
        filesToRender.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.dataset.id = file.id;
            
            // Determine file icon based on file type
            let fileIcon = 'fa-file';
            if (file.mimeType) {
                if (file.mimeType.startsWith('image/')) fileIcon = 'fa-file-image';
                else if (file.mimeType.startsWith('video/')) fileIcon = 'fa-file-video';
                else if (file.mimeType.startsWith('audio/')) fileIcon = 'fa-file-audio';
                else if (file.mimeType.includes('pdf')) fileIcon = 'fa-file-pdf';
                else if (file.mimeType.includes('word')) fileIcon = 'fa-file-word';
                else if (file.mimeType.includes('excel') || file.mimeType.includes('spreadsheet')) fileIcon = 'fa-file-excel';
                else if (file.mimeType.includes('zip') || file.mimeType.includes('archive')) fileIcon = 'fa-file-archive';
            }

            fileItem.innerHTML = `
                <div class="file-icon">
                    <i class="fas ${fileIcon}"></i>
                </div>
                <div class="file-details">
                    <div class="file-name">${escapeHtml(file.name)}</div>
                    <div class="file-meta">
                        <span class="file-size">${formatFileSize(file.size)}</span>
                        <span class="file-date">${formatDate(new Date(file.uploadedAt))}</span>
                        ${file.groupName ? `<span class="file-group">${escapeHtml(file.groupName)}</span>` : ''}
                    </div>
                </div>
                <div class="file-actions">
                    <button class="action-btn download-btn" title="Download" data-id="${file.id}">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="action-btn delete-btn" title="Delete" data-id="${file.id}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            `;
            filesList.appendChild(fileItem);
        });

        // Add event listeners to file action buttons
        document.querySelectorAll('.download-btn').forEach(btn => {
            btn.addEventListener('click', () => downloadFile(btn.dataset.id));
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteFile(btn.dataset.id));
        });
    }

    // Search files
    function searchFiles() {
        if (!searchInput) return;
        
        const searchTerm = searchInput.value.toLowerCase().trim();
        
        if (searchTerm === '') {
            renderFiles(files);
            return;
        }
        
        const filteredFiles = files.filter(file => 
            file.name.toLowerCase().includes(searchTerm)
        );
        
        renderFiles(filteredFiles);
    }

    // Download file
    async function downloadFile(fileId) {
        try {
            window.location.href = `${ENDPOINTS.FILES}/${fileId}/download`;
        } catch (error) {
            showNotification('Error downloading file', 'error');
            console.error('Error downloading file:', error);
        }
    }

    // Delete file
    async function deleteFile(fileId) {
        if (!confirm('Are you sure you want to delete this file?')) return;

        try {
            const response = await fetch(`${ENDPOINTS.FILES}/${fileId}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Failed to delete file');
            
            showNotification('File deleted successfully', 'success');
            refreshFilesList();
        } catch (error) {
            showNotification('Error deleting file', 'error');
            console.error('Error deleting file:', error);
        }
    }

    // Helper: Escape HTML to prevent XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Helper: Format file size
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Helper: Format date
    function formatDate(date) {
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Helper: Show notification
    function showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
                <span>${escapeHtml(message)}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 500);
        }, 3000);
    }

    // Override console access to openModal function for security
    const originalOpenModal = window.openModal;
    window.openModal = function() {
        if (!fileSharingEnabled) {
            console.warn('File sharing is disabled. Cannot open modal via console.');
            showDisabledModal();
            return;
        }
        if (originalOpenModal) {
            originalOpenModal.call(this);
        } else {
            openModal();
        }
    };

    // Add styles for modal backdrop blur effect
    const style = document.createElement('style');
    style.textContent = `
        .modal, .disabled-modal {
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
        }
    `;
    document.head.appendChild(style);

    // Expose necessary functions globally for external access
    window.goToHostPage = goToHostPage;
    window.handleToolClick = handleToolClick;
});
   function closeDisabledModal() {
            disabledModal.style.display = 'none';
        }