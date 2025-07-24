    // User info - Normally this would come from your application
        const userFullName = "Jane Smith"; // This would be the actual variable from your app

        // DOM Elements
        const actionToggle = document.getElementById('actionToggle');
        const actionPanel = document.getElementById('actionPanel');
        const startCaptureBtn = document.getElementById('startCaptureBtn');
        const captureDialog = document.getElementById('captureDialog');
        const dismissDialog = document.getElementById('dismissDialog');
        const navTabs = document.querySelectorAll('.nav-tab');
        const tabSections = document.querySelectorAll('.tab-section');
        const beginBtn = document.getElementById('beginBtn');
        const PauseBtn = document.getElementById('PauseBtn');
        const endBtn = document.getElementById('endBtn');
        const captureTimer = document.getElementById('captureTimer');
        const statusTimer = document.getElementById('statusTimer');
        const captureStatus = document.getElementById('captureStatus');
        const statusMessage = document.getElementById('statusMessage');
        const previewArea = document.getElementById('previewArea');
        const soundSwitch = document.getElementById('soundSwitch');
        const captureArchive = document.getElementById('captureArchive');
        const profileNameElement = document.getElementById('profileName');
        const profileInitials = document.getElementById('profileInitials');

        // Set up user information
        profileNameElement.textContent = userFullName;
        profileInitials.textContent = userFullName.split(' ').map(name => name[0]).join('');

        // State variables
        let captureRecorder;
        let capturedChunks = [];
        let captureStream;
        let timeInterval;
        let captureDuration = 0;
        let isPauseed = false;
        let isCapturing = false;
        let captures = JSON.parse(localStorage.getItem('screenCaptures') || '[]');
        let accessGranted = {
            screen: false,
            audio: false
        };

        // Initialize the app
        function initialize() {
            renderCaptureArchive();
            
            // Event listeners
            actionToggle.addEventListener('click', toggleActionPanel);
            startCaptureBtn.addEventListener('click', showCaptureDialog);
            dismissDialog.addEventListener('click', hideCaptureDialog);
            
            // Tab navigation
            navTabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const tabId = tab.getAttribute('data-tab');
                    
                    navTabs.forEach(t => t.classList.remove('active'));
                    tabSections.forEach(ts => ts.classList.remove('active'));
                    
                    tab.classList.add('active');
                    document.getElementById(`${tabId}Section`).classList.add('active');
                });
            });
            
            // Capture controls
            beginBtn.addEventListener('click', beginCapture);
            PauseBtn.addEventListener('click', togglePauseCapture);
            endBtn.addEventListener('click', endCapture);
            
            // Close panel when clicking outside
            document.addEventListener('click', function(event) {
                if (!actionPanel.contains(event.target) && !actionToggle.contains(event.target) && actionPanel.classList.contains('visible')) {
                    actionPanel.classList.remove('visible');
                }
            });
            
            // Close dialog when clicking on overlay
            captureDialog.addEventListener('click', function(event) {
                if (event.target === captureDialog) {
                    hideCaptureDialog();
                }
            });

            // Add resolution options
            addResolutionOptions();
        }

        // Add screen capture resolution options
        function addResolutionOptions() {
            const resolutionSelector = document.createElement('div');
            resolutionSelector.className = 'setting-group';
            resolutionSelector.innerHTML = `
                <label class="setting-label">Capture Resolution:</label>
                <select class="capture-selector" id="resolutionSelect">
                    <option value="high">High Resolution (1080p)</option>
                    <option value="medium" selected>Medium Resolution (720p)</option>
                    <option value="low">Low Resolution (480p)</option>
                </select>
            `;
            
            // Insert at the beginning of capture-settings
            const captureSettings = document.querySelector('.capture-settings');
            captureSettings.insertBefore(resolutionSelector, captureSettings.firstChild);
        }

        // Toggle action panel display
        function toggleActionPanel(event) {
            event.stopPropagation();
            actionPanel.classList.toggle('visible');
        }

        // Show capture dialog
        function showCaptureDialog() {
         
        }

        // Hide capture dialog
        function hideCaptureDialog() {
            captureDialog.classList.remove('visible');
            
            // If capturing is active, show the status
            if (isCapturing) {
                captureStatus.style.display = 'flex';
            } else {
                resetCaptureInterface();
            }
        }

        // Reset capture interface
        function resetCaptureInterface() {
            captureDuration = 0;
            captureTimer.textContent = formatDuration(0);
            isPauseed = false;
            
            beginBtn.classList.remove('inactive');
            PauseBtn.classList.add('inactive');
            endBtn.classList.add('inactive');
            
            PauseBtn.innerHTML = '<i class="fas fa-pause icon"></i><span class="label">Pause</span>';
            
            if (previewArea.querySelector('.media-player')) {
                previewArea.querySelector('.media-player').remove();
                previewArea.innerHTML = '<div class="empty-preview">No preview available</div>';
            }
        }

        // Format duration for display (HH:MM:SS)
        function formatDuration(seconds) {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secondsLeft = seconds % 60;
            
            return [hours, minutes, secondsLeft]
                .map(val => val < 10 ? `0${val}` : val)
                .join(':');
        }

        // Start the capture timer
        function startTimer() {
            clearInterval(timeInterval);
            
            timeInterval = setInterval(() => {
                if (!isPauseed) {
                    captureDuration++;
                    captureTimer.textContent = formatDuration(captureDuration);
                    statusTimer.textContent = formatDuration(captureDuration);
                }
            }, 1000);
        }

        // Show notification message
        function showNotification(message, type = 'success') {
            statusMessage.textContent = message;
            statusMessage.className = `notification ${type} visible`;
            
            setTimeout(() => {
                statusMessage.classList.remove('visible');
            }, 5000);
        }

        // Get the selected resolution constraints
        function getResolutionConstraints() {
            const resolution = document.getElementById('resolutionSelect').value;
            let constraints = {};
            
            switch (resolution) {
                case 'high':
                    constraints = {
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                        frameRate: { ideal: 30 }
                    };
                    break;
                case 'medium':
                    constraints = {
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        frameRate: { ideal: 30 }
                    };
                    break;
                case 'low':
                    constraints = {
                        width: { ideal: 854 },
                        height: { ideal: 480 },
                        frameRate: { ideal: 24 }
                    };
                    break;
                default:
                    constraints = {
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        frameRate: { ideal: 30 }
                    };
            }
            
            return constraints;
        }

        // Begin capture
        async function beginCapture() {
            try {
                const audioEnabled = soundSwitch.checked;
                const videoConstraints = getResolutionConstraints();
                
                const displayMediaOptions = {
                    video: videoConstraints,
                    audio: audioEnabled,
                    cursor: "always"
                };
                
                // Only request screen capture permission if not already granted
                if (!accessGranted.screen) {
                    // Get the screen capture stream
                    captureStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
                    accessGranted.screen = true;
                } else {
                    // Use existing permission
                    captureStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
                }
                
                // If we want audio from microphone too and permission not already granted
                if (audioEnabled && !accessGranted.audio) {
                    try {
                        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        const audioTracks = audioStream.getAudioTracks();
                        if (audioTracks.length > 0) {
                            captureStream.addTrack(audioTracks[0]);
                            accessGranted.audio = true;
                        }
                    } catch (err) {
                        console.warn("Could not get microphone access:", err);
                        showNotification("Could not access microphone. Capturing with system audio only.", "warning");
                    }
                } else if (audioEnabled && accessGranted.audio) {
                    // Use existing audio permission
                    try {
                        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        const audioTracks = audioStream.getAudioTracks();
                        if (audioTracks.length > 0) {
                            captureStream.addTrack(audioTracks[0]);
                        }
                    } catch (err) {
                        console.warn("Could not get microphone access:", err);
                        showNotification("Could not access microphone. Capturing with system audio only.", "warning");
                    }
                }
                
                // Create MediaRecorder instance with good quality
                const options = { 
                    mimeType: 'video/webm;codecs=vp9,opus',
                    videoBitsPerSecond: 3000000 // 3 Mbps for good quality
                };
                
                try {
                    captureRecorder = new MediaRecorder(captureStream, options);
                } catch (e) {
                    // Fallback if the codec is not supported
                    captureRecorder = new MediaRecorder(captureStream, { mimeType: 'video/webm' });
                }
                
                // Event listeners for MediaRecorder
                captureRecorder.ondataavailable = handleDataAvailable;
                captureRecorder.onstop = handleStop;
                
                // Create video preview
                const videoPreview = document.createElement('video');
                videoPreview.srcObject = captureStream;
                videoPreview.autoplay = true;
                videoPreview.muted = true; // Avoid feedback loop
                previewArea.innerHTML = '';
                previewArea.appendChild(videoPreview);
                
                // Update UI
                beginBtn.classList.add('inactive');
                PauseBtn.classList.remove('inactive');
                endBtn.classList.remove('inactive');
                captureStatus.style.display = 'flex';
                
                // Track stream ending (user canceled via browser UI)
                captureStream.getVideoTracks()[0].onended = () => {
                    if (isCapturing) {
                        endCapture();
                    }
                };
                
                // Start capturing
                captureRecorder.start(1000); // Collect data every second
                isCapturing = true;
                captureDuration = 0;
                capturedChunks = [];
                startTimer();
                
                showNotification("Capture started successfully");
                
            } catch (err) {
                console.error("Error starting capture:", err);
                showNotification("Failed to start capture: " + err.message, "error");
            }
        }

        // Toggle Pause/resume capture
        function togglePauseCapture() {
            if (!isCapturing) return;
            
            if (isPauseed) {
                // Resume capture
                captureRecorder.resume();
                isPauseed = false;
                PauseBtn.innerHTML = '<i class="fas fa-pause icon"></i><span class="label">Pause</span>';
                showNotification("Capture resumed");
            } else {
                // Pause capture
                captureRecorder.pause();
                isPauseed = true;
                PauseBtn.innerHTML = '<i class="fas fa-play icon"></i><span class="label">Resume</span>';
                showNotification("Capture paused");
            }
        }

        // End capture
        function endCapture() {
            if (!isCapturing) return;
            
            captureRecorder.stop();
            captureStream.getTracks().forEach(track => track.stop());
            clearInterval(timeInterval);
            
            // Update UI
            captureStatus.style.display = 'none';
            beginBtn.classList.remove('inactive');
            PauseBtn.classList.add('inactive');
            endBtn.classList.add('inactive');
            
            isCapturing = false;
            isPauseed = false;
        }

        // Handle captured data
        function handleDataAvailable(event) {
            if (event.data.size > 0) {
                capturedChunks.push(event.data);
            }
        }

        // Handle capture stop
        function handleStop() {
            const blob = new Blob(capturedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            
            // Create a video element for preview
            const videoPreview = document.createElement('video');
            videoPreview.src = url;
            videoPreview.controls = true;
            previewArea.innerHTML = '';
            previewArea.appendChild(videoPreview);
            
            // Save capture to local storage
            const now = new Date();
            const newCapture = {
                id: `cap_${Date.now()}`,
                name: `Capture ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
                date: now.toISOString(),
                duration: captureDuration,
                url: url,
                blob: blob
            };
            
            captures.push(newCapture);
            saveCaptures();
            renderCaptureArchive();
            
            showNotification("Capture saved successfully");
        }

        // Save captures to localStorage
        function saveCaptures() {
            // We can't store Blob directly in localStorage, so we'll store metadata
            const capturesToSave = captures.map(cap => ({
                id: cap.id,
                name: cap.name,
                date: cap.date,
                duration: cap.duration,
                url: cap.url
            }));
            
            localStorage.setItem('screenCaptures', JSON.stringify(capturesToSave));
        }

        // Render capture archive
        function renderCaptureArchive() {
            if (captures.length === 0) {
                captureArchive.innerHTML = '<div class="empty-preview">No captures found</div>';
                return;
            }
            
            captureArchive.innerHTML = '';
            
            captures.forEach((capture, index) => {
                const captureEntry = document.createElement('div');
                captureEntry.className = 'history-entry';
                captureEntry.innerHTML = `
                    <div class="entry-details">
                        <div class="entry-title">${capture.name}</div>
                        <div class="entry-meta">
                            <span class="meta-item">${new Date(capture.date).toLocaleString()}</span>
                            <span class="meta-item">Duration: ${formatDuration(capture.duration)}</span>
                        </div>
                    </div>
                    <div class="entry-actions">
                        <button class="entry-btn view has-tooltip" data-tooltip="View" data-index="${index}">
                            <i class="fas fa-play"></i>
                        </button>
                        <button class="entry-btn save has-tooltip" data-tooltip="Save" data-index="${index}">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="entry-btn remove has-tooltip" data-tooltip="Remove" data-index="${index}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
                
                captureArchive.appendChild(captureEntry);
            });
            
            // Add event listeners for capture actions
            captureArchive.querySelectorAll('.entry-btn').forEach(btn => {
                btn.addEventListener('click', handleCaptureAction);
            });
        }

        // Handle capture actions (view, save, remove)
        function handleCaptureAction(event) {
            const button = event.currentTarget;
            const index = parseInt(button.getAttribute('data-index'));
            const capture = captures[index];
            
            if (button.classList.contains('view')) {
                viewCapture(capture);
            } else if (button.classList.contains('save')) {
                saveCapture(capture);
            } else if (button.classList.contains('remove')) {
                removeCapture(index);
            }
        }

        // View capture
        function viewCapture(capture) {
            const videoPlayer = document.createElement('video');
            videoPlayer.src = capture.url;
            videoPlayer.controls = true;
            videoPlayer.className = 'media-player';
            
            // Create dialog for playback
            const playbackDialog = document.createElement('div');
            playbackDialog.className = 'dialog-overlay visible';
            playbackDialog.innerHTML = `
                <div class="dialog-box">
                    <div class="dialog-header">
                        <h2 class="dialog-title">${capture.name}</h2>
                        <button class="dismiss-btn">&times;</button>
                    </div>
                    <div class="dialog-content" style="padding: 0;">
                        <div style="background: #000; display: flex; justify-content: center;">
                            ${videoPlayer.outerHTML}
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(playbackDialog);
            
            // Auto-play
            playbackDialog.querySelector('.media-player').play();
            
            // Close button
            playbackDialog.querySelector('.dismiss-btn').addEventListener('click', () => {
                playbackDialog.remove();
            });
            
            // Click outside to close
            playbackDialog.addEventListener('click', (e) => {
                if (e.target === playbackDialog) {
                    playbackDialog.remove();
                }
            });
        }

        // Save capture
        function saveCapture(capture) {
            const a = document.createElement('a');
            a.href = capture.url;
            a.download = `${capture.name}.webm`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }

        // Remove capture
        function removeCapture(index) {
            const confirmRemove = confirm('Are you sure you want to remove this capture?');
            
            if (confirmRemove) {
                const removedCapture = captures.splice(index, 1)[0];
                
                // Revoke object URL to free memory
                URL.revokeObjectURL(removedCapture.url);
                
                saveCaptures();
                renderCaptureArchive();
                showNotification("Capture removed successfully");
            }
        }

        // Check for browser support
        function checkBrowserSupport() {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                showNotification("Your browser doesn't support screen capturing", "error");
                beginBtn.classList.add('inactive');
                return false;
            }
            return true;
        }

        // Initialize the application
        document.addEventListener('DOMContentLoaded', () => {
            initialize();
            checkBrowserSupport();
        });

        // Enhanced features - keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Alt+C to open capture dialog
            if (e.altKey && e.key === 'c') {
                showCaptureDialog();
            }
            
            // Space to toggle Pause/resume when capturing
            if (e.code === 'Space' && isCapturing && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                e.preventDefault();
                togglePauseCapture();
            }
            
            // Escape to close dialog if open
            if (e.key === 'Escape' && captureDialog.classList.contains('visible')) {
                hideCaptureDialog();
            }
        });