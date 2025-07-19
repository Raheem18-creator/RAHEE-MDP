// public/script.js - New Interactions
document.addEventListener('DOMContentLoaded', () => {
    const pairCodeForm = document.getElementById('pairCodeForm');
    const phoneNumberInput = document.getElementById('phoneNumber');
    const submitBtn = document.getElementById('submitBtn');
    const statusMessage = document.getElementById('statusMessage');
    const pairingCodeDisplay = document.getElementById('pairingCodeDisplay');
    const sessionIdDisplay = document.getElementById('sessionIdDisplay');
    const resultBox = document.getElementById('result');
    const copyCodeBtn = document.getElementById('copyCodeBtn');
    const codeArea = document.getElementById('codeArea'); // Container for code and copy button

    resultBox.classList.add('hidden'); // Start the result box hidden

    pairCodeForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Prevent default form submission and page reload

        const phoneNumber = phoneNumberInput.value.trim();
        if (!phoneNumber) {
            statusMessage.textContent = "Please enter your WhatsApp number.";
            statusMessage.style.color = "red";
            resultBox.classList.remove('hidden'); // Show result box for error message
            pairingCodeDisplay.textContent = "";
            sessionIdDisplay.textContent = "";
            codeArea.style.display = "none"; // Hide code area
            return;
        }

        // Disable the submit button and show a loading state
        submitBtn.disabled = true;
        submitBtn.textContent = "Generating...";
        
        // Reset and display status messages
        statusMessage.textContent = "Requesting pairing code...";
        statusMessage.style.color = "#007bff"; // Info blue color
        pairingCodeDisplay.textContent = "";
        sessionIdDisplay.textContent = "";
        resultBox.classList.remove('hidden'); // Ensure result box is visible
        codeArea.style.display = "none"; // Hide code area until code is received
        copyCodeBtn.textContent = "Copy"; // Reset copy button text

        try {
            // Send a POST request to our backend API
            const response = await fetch('/api/pair-code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ phoneNumber: phoneNumber }) // Send phone number as JSON
            });

            const data = await response.json(); // Parse the JSON response from the server

            if (data.success) {
                if (data.code) {
                    // If a pairing code is received
                    statusMessage.textContent = "Pairing code generated! Enter it in WhatsApp Linked Devices.";
                    statusMessage.style.color = "#28a745"; // Success green
                    pairingCodeDisplay.textContent = data.code; // Display the pairing code
                    sessionIdDisplay.textContent = `Session ID: ${data.sessionId}`;
                    codeArea.style.display = "flex"; // Show the code area
                } else if (data.alreadyConnected) {
                    // If the session was already connected
                    statusMessage.textContent = "Session already active for this number. No new code needed.";
                    statusMessage.style.color = "#28a745";
                    pairingCodeDisplay.textContent = "";
                    sessionIdDisplay.textContent = `Session ID: ${data.sessionId}`;
                    codeArea.style.display = "none";
                } else {
                    // Generic success message if no code but successful request
                    statusMessage.textContent = data.message || "Request successful, awaiting connection on WhatsApp.";
                    statusMessage.style.color = "#28a745";
                    pairingCodeDisplay.textContent = "";
                    sessionIdDisplay.textContent = `Session ID: ${data.sessionId}`;
                    codeArea.style.display = "none";
                }
            } else {
                // Handle API errors
                statusMessage.textContent = data.message || "Failed to get pairing code. Please check your number.";
                statusMessage.style.color = "red";
                pairingCodeDisplay.textContent = "";
                sessionIdDisplay.textContent = "";
                codeArea.style.display = "none";
            }
        } catch (error) {
            // Handle network errors or other unexpected issues
            console.error('Error fetching pairing code:', error);
            statusMessage.textContent = "An error occurred. Please try again later.";
            statusMessage.style.color = "red";
            pairingCodeDisplay.textContent = "";
            sessionIdDisplay.textContent = "";
            codeArea.style.display = "none";
        } finally {
            // Re-enable the submit button regardless of success or failure
            submitBtn.disabled = false;
            submitBtn.textContent = "Generate Pairing Code";
        }
    });

    // --- Copy to Clipboard Functionality ---
    copyCodeBtn.addEventListener('click', () => {
        const codeText = pairingCodeDisplay.textContent;
        if (codeText) {
            // Use the Clipboard API to copy text
            navigator.clipboard.writeText(codeText)
                .then(() => {
                    copyCodeBtn.textContent = "Copied!";
                    setTimeout(() => {
                        copyCodeBtn.textContent = "Copy"; // Reset button text after 2 seconds
                    }, 2000);
                })
                .catch(err => {
                    console.error('Failed to copy text: ', err);
                    copyCodeBtn.textContent = "Failed!";
                });
        }
    });
});
