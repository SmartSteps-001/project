  (function() {
            // Create secure functions that cannot be accessed from console
            const secureNamespace = {};
            
            // Protect functions from console access
            const createSecureFunction = (name, fn) => {
                Object.defineProperty(window, name, {
                    value: function() {
                        throw new Error(`Access denied: ${name} cannot be called manually`);
                    },
                    writable: false,
                    configurable: false
                });
                
                secureNamespace[name] = fn;
                return secureNamespace[name];
            };

            function enableHandRaising() {
  if (!handRaisingEnabled) {
    console.log('Enabling hand raising...');
    
    // Use the existing toggle function to enable
    const result = toggleHandRaising();
    
    // Show success toast notification (replace any existing hand raising toast)
    if (result) {
      handRaisingToastId = showSuccessToast('Raising Hands has been enabled by meeting Host.', 5000, handRaisingToastId);
    }
    
    return result;
  } else {
    console.log('Hand raising is already enabled');
    return true;
  }
}
         function disableHandRaising() {
  if (handRaisingEnabled) {
    console.log('Disabling hand raising...');
    
    // Use the existing toggle function to disable
    const result = !toggleHandRaising(); // toggleHandRaising returns the new state, we want false for disabled
    
    // Show warning toast notification (replace any existing hand raising toast)
    if (result) {
      handRaisingToastId = showWarningToast('Raising Hands has been disabled by meeting host', 6000, handRaisingToastId);
    }
    
    return !result; // Return false when successfully disabled
  } else {
    console.log('Hand raising is already disabled');
    return false;
  }
}

            // Create protected functions
            const protectedEnableHandRaising = createSecureFunction('enableHandRaising', function() {
            
                enableHandRaising();
            });

            const protectedDisableHandRaising = createSecureFunction('disableHandRaising', function() {
                disableHandRaising();
            });

            // Socket.IO connection
            const socket = io();
            const connectionStatus = document.getElementById('connectionStatus');

            // Identify as participant
            socket.emit('identify-as-participant');

            socket.on('connect', () => {
                connectionStatus.textContent = 'Connected to meeting';
                connectionStatus.className = 'status-indicator status-connected';
            });

            socket.on('disconnect', () => {
                connectionStatus.textContent = 'Disconnected from meeting';
                connectionStatus.className = 'status-indicator status-disconnected';
            });

            socket.on('meeting-state', (state) => {
                if (state.handRaisingEnabled) {
                    protectedEnableHandRaising();
                } else {
                    protectedDisableHandRaising();
                }
            });

            socket.on('hand-raising-toggle', (enabled) => {
                if (enabled) {
                    protectedEnableHandRaising();
                } else {
                    protectedDisableHandRaising();
                }
            });

            // Hand raise button functionality
            document.getElementById('handRaiseButton').addEventListener('click', () => {
                // Add hand raise logic here
                alert('Hand raised! 🙋‍♂️');
            });

            // Prevent function access through various methods
            Object.freeze(window.enableHandRaising);
            Object.freeze(window.disableHandRaising);
            
            // Block eval and Function constructor access to protected functions
            const originalEval = window.eval;
            window.eval = function(code) {
                if (code.includes('enableHandRaising') || code.includes('disableHandRaising')) {
                    throw new Error('Access denied: Protected functions cannot be accessed');
                }
                return originalEval(code);
            };

            // Additional protection against Function constructor
            const originalFunction = window.Function;
            window.Function = function() {
                const code = arguments[arguments.length - 1];
                if (code && (code.includes('enableHandRaising') || code.includes('disableHandRaising'))) {
                    throw new Error('Access denied: Protected functions cannot be accessed');
                }
                return originalFunction.apply(this, arguments);
            };
        })();