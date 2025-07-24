  const sendButton = document.getElementById('sendButton');
        const chatButton = document.getElementById('chatButton');
        const popupOverlay = document.getElementById('popupOverlay');
        const statusBanner = document.getElementById('statusBanner');

        let chatDisabled = false;

        // Check chat state from backend
        async function checkChatState() {            
            try {
                const response = await fetch('/api/chat-state');
                const state = await response.json();
                
                chatDisabled = state.chatDisabled;
                updateUIState();
            } catch (error) {
                console.error('Error checking chat state:', error);
            }
        }

        function updateUIState() {
            if (chatDisabled) {
                // Instead of using disabled attribute, use a CSS class
                sendButton.classList.add('disabled');
                chatButton.classList.add('disabled');
                statusBanner.classList.add('show');
            } else {
                sendButton.classList.remove('disabled');
                chatButton.classList.remove('disabled');
                statusBanner.classList.remove('show');
            }
        }

        function toggleChat() {
            if (chatDisabled) {
                showPopup();
                return;
            }
            
            // Normal chat toggle functionality here
            console.log('Chat toggled');
        }

        function showPopup() {
            popupOverlay.classList.add('show');
        }

        function closePopup() {
            popupOverlay.classList.remove('show');
        }

        // Add click event listeners that check for disabled state
        sendButton.addEventListener('click', function(e) {
            if (chatDisabled) {
                e.preventDefault();
                showPopup();
                return;
            }
            
            // Normal send functionality here
            console.log('Message sent');
        });

        // Add click event listener to chat button as well
        chatButton.addEventListener('click', function(e) {
            if (chatDisabled) {
                e.preventDefault();
                showPopup();
                return;
            }
            
            // Normal chat functionality here
            console.log('Chat toggled');
        });

        // Close popup when clicking outside
        popupOverlay.addEventListener('click', function(e) {
            if (e.target === popupOverlay) {
                closePopup();
            }
        });

        // Poll for state changes every 2 seconds
        setInterval(checkChatState, 2000);
        
        // Initial state check
        checkChatState();

        // For testing purposes - simulate disabled state after 3 seconds
        setTimeout(() => {
            chatDisabled = true;
            updateUIState();
        }, 3000);