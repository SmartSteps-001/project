// Audio Input Volume Control
let audioContext;
let mediaStream;
let gainNode;
let source;

// Initialize audio context and get user media
async function initializeAudio() {
    try {
        // Create audio context
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Get user media (microphone)
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
            audio: true 
        });
        
        // Create audio nodes
        source = audioContext.createMediaStreamSource(mediaStream);
        gainNode = audioContext.createGain();
        
        // Connect the nodes
        source.connect(gainNode);
        
        // Set initial volume (75% = 0.75)
        gainNode.gain.value = 0.75;
        
        console.log('Audio initialized successfully');
        
    } catch (error) {
        console.error('Error accessing microphone:', error);
        alert('Could not access microphone. Please check permissions.');
    }
}

// Volume slider control
const volumeSlider = document.getElementById('volume-slider');

volumeSlider.addEventListener('input', function() {
    if (gainNode) {
        // Convert slider value (0-100) to gain value (0-1)
        const volume = this.value / 100;
        gainNode.gain.value = volume;
        
        console.log(`Volume set to: ${this.value}% (${volume})`);
    }
});

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Add click handler to start audio (required for user interaction)
    const startButton = document.createElement('button');
    startButton.textContent = 'Start Audio Input';
    startButton.style.cssText = 'margin: 10px; padding: 10px 20px; font-size: 16px;';
    
    startButton.addEventListener('click', function() {
        initializeAudio();
        this.disabled = true;
        this.textContent = 'Audio Active';
    });
    
    // Insert button before the slider
    const sliderItem = document.querySelector('.slider-item');
    sliderItem.parentNode.insertBefore(startButton, sliderItem);
});

// Optional: Create a destination for the processed audio
// This connects the gain node to speakers (for monitoring)
function enableMonitoring() {
    if (gainNode && audioContext) {
        gainNode.connect(audioContext.destination);
    }
}

// Optional: Get the processed audio stream for recording
function getProcessedStream() {
    if (gainNode && audioContext) {
        const destination = audioContext.createMediaStreamDestination();
        gainNode.connect(destination);
        return destination.stream;
    }
    return null;
}

// Cleanup function
function stopAudio() {
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
    }
    if (audioContext) {
        audioContext.close();
    }
}