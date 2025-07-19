// routes/pairCode.js
const { makeid } = require('../utils/gen-id'); // Utility to generate unique IDs
const express = require('express');
const fs = require('fs'); // Node.js File System module
const pino = require("pino"); // Logger for Baileys
const { default: makeWASocket, useMultiFileAuthState, delay, Browsers, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');

const router = express.Router();

// A Map to store active Baileys socket instances.
// This allows the server to manage multiple concurrent sessions without shutting down.
const activeBaileysSessions = new Map();

/**
 * Safely removes a file or directory.
 * @param {string} filePath - The path to the file or directory.
 * @returns {boolean} True if removed, false otherwise.
 */
function removeFile(filePath) {
    if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { recursive: true, force: true });
        return true;
    }
    return false;
}

/**
 * Initializes a new Baileys session and handles its lifecycle.
 * This function is called for each new pairing request.
 * @param {string} sessionId - A unique ID for this specific session.
 * @param {string} phoneNumber - The user's WhatsApp phone number (cleaned).
 * @param {object} res - Express response object to send the initial pairing code.
 */
async function initializeBaileysSession(sessionId, phoneNumber, res) {
    const sessionDirPath = `./sessions/${sessionId}`; // Directory for session files
    const WA_LOGGER = pino({ level: "fatal" }).child({ level: "fatal" }); // Baileys logger instance

    // Create the session directory if it doesn't exist
    if (!fs.existsSync(sessionDirPath)) {
        fs.mkdirSync(sessionDirPath, { recursive: true });
    }

    try {
        // useMultiFileAuthState manages reading and writing credentials to files
        const { state, saveCreds } = await useMultiFileAuthState(sessionDirPath);

        // Configure and create the Baileys WebSocket instance
        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, WA_LOGGER),
            },
            printQRInTerminal: false, // Don't print QR code to console
            generateHighQualityLinkPreview: true,
            logger: WA_LOGGER,
            syncFullHistory: false, // Prevent downloading full chat history for faster connection
            browser: Browsers.macOS("Safari") // Simulate a macOS Safari browser
        });

        // Store the socket instance in our map for management
        activeBaileysSessions.set(sessionId, sock);
        console.log(`[${sessionId}] Session initialized for phone: ${phoneNumber}`);

        // If the session is not yet registered (i.e., new connection)
        if (!sock.authState.creds.registered) {
            await delay(1500); // Small delay before requesting the code
            const pairingCode = await sock.requestPairingCode(phoneNumber);
            // Check if response has already been sent to prevent errors
            if (!res.headersSent) {
                // Send the pairing code and session ID back to the client immediately
                return res.json({
                    success: true,
                    code: pairingCode,
                    sessionId: sessionId,
                    message: "Pairing code generated. Please use it on your WhatsApp. Waiting for connection..."
                });
            }
        } else {
            // If the session is already registered (e.g., trying to re-register)
            if (!res.headersSent) {
                return res.json({
                    success: true,
                    message: "Session already registered. No new pairing code needed.",
                    sessionId: sessionId,
                    alreadyConnected: true
                });
            }
            // Close existing registered sockets and clean up if not needed
            await sock.ws.close();
            removeFile(sessionDirPath);
            activeBaileysSessions.delete(sessionId);
            return;
        }

        // --- Event Handlers ---
        // Save credentials whenever they are updated (e.g., new keys generated)
        sock.ev.on('creds.update', saveCreds);

        // Handle connection state changes
        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;

            // --- Connection Opened Successfully ---
            if (connection === "open") {
                console.log(`[${sessionId}] Connection OPENED for ${sock.user.id}`);
                await delay(5000); // Give some time for credentials to be fully written to file

                const credsFilePath = `${sessionDirPath}/creds.json`;

                // Verify that the creds.json file exists
                if (!fs.existsSync(credsFilePath)) {
                    console.error(`[${sessionId}] ERROR: creds.json not found at ${credsFilePath}`);
                    await sock.ws.close();
                    removeFile(sessionDirPath);
                    activeBaileysSessions.delete(sessionId);
                    return;
                }

                try {
                    // Read the credentials file
                    const credsData = fs.readFileSync(credsFilePath, 'utf8');
                    
                    // --- GENERATE CUSTOM SHORT SESSION STRING (Base64 Encoded) ---
                    // Encode the entire creds.json content to a Base64 string.
                    // This will be shorter than the raw JSON but longer than a simple database ID.
                    const base64Session = Buffer.from(credsData).toString('base64');
                    // Prefix with your bot's name as requested
                    const finalSessionString = `RAHEEM-XMD-3>>>${base64Session}`;
                    // --- END CUSTOM SESSION STRING GENERATION ---

                    // Send the generated session string to the connected WhatsApp number
                    const messageToSelf = `RAHEEM-XMD-3 Session String:\n\n\`\`\`${finalSessionString}\`\`\`\n\n*Copy this string and use it to connect your bot.*`;
                    await sock.sendMessage(sock.user.id, { text: messageToSelf });

                    // Get current time and date in Dar es Salaam timezone for the welcome message
                    const tanzaniaTime = new Date().toLocaleTimeString('en-TZ', { timeZone: 'Africa/Dar_es_Salaam' });
                    const tanzaniaDate = new Date().toLocaleDateString('en-TZ', { timeZone: 'Africa/Dar_es_Salaam' });

                    // Construct the detailed bot description message
                    const botDescription = `🟢  *BOT SUCCESSFULLY CONNECTED 🟢!*
                
╭━━ 『 RAHEEM-XMD-3 INITIALIZED 』
┃  ⚡ BOT NAME: RAHEEM-XMD-3 
┃  👑 OWNER: Raheem-cm 
┃  ⚙️ MODE: *private*
┃  🎯 PREFIX: *.*
┃  ⏳ TIME: *${tanzaniaTime}*
┃  📆 DATE: ${tanzaniaDate}
╰━━━━━━━━━━━━━━━━━━━╯

⚠️ REPORT ANY GLITCHES DIRECTLY TO THE OWNER.

╭──────────────────★
│ POWERED BY Raheem-cm
╰──────────────────★
📢 CHANNEL: Click Here(https://whatsapp.com/channel/0029VbAffhD2ZjChG9DX922r)
🛠️ DEPLOY YOUR BOT: GitHub Repo(https://github.com/Raheem-cm/RAHEEM-XMD-3)

🔋  SYSTEM STATUS: RAHEEM-XMD-3 100% 🧐  A.I READY • MULTI DEVICE • STABLE RELEASE
`;

                    // Send the descriptive welcome message with an external ad reply
                    await sock.sendMessage(sock.user.id, {
                        text: botDescription,
                        contextInfo: {
                            externalAdReply: {
                                title: "PEACE MD💚",
                                thumbnailUrl: "https://files.catbox.moe/wtjh55.jpg",
                                sourceUrl: "https://github.com/Raheem-cm/RAHEEM-XMD-3",
                                mediaType: 1,
                                renderLargerThumbnail: true
                            }
                        }
                    });

                    await delay(1000); // Give a bit more time for messages to completely send
                    await sock.ws.close(); // Close the WebSocket connection after successful setup
                    console.log(`[${sessionId}] Session successfully connected, messages sent, and socket closed.`);

                    // Since we've sent the Base64 session string, the local files are no longer strictly needed
                    // and can be cleaned up to save space, especially on ephemeral storage like Render Free Tier.
                    removeFile(sessionDirPath);
                    activeBaileysSessions.delete(sessionId); // Remove from the active sessions map

                } catch (sendError) {
                    console.error(`[${sessionId}] ERROR sending messages after connection:`, sendError);
                    // If message sending fails, close the socket and clean up
                    await sock.ws.close();
                    removeFile(sessionDirPath);
                    activeBaileysSessions.delete(sessionId);
                }

            }
            // --- Connection Closed ---
            else if (connection === "close") {
                // Determine if a retry is allowed (not an authentication failure)
                const retryAllowed = lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401;

                if (retryAllowed) {
                    console.log(`[${sessionId}] Connection closed, attempting retry due to:`, lastDisconnect.error);
                    removeFile(sessionDirPath); // Clean up existing files before retry
                    activeBaileysSessions.delete(sessionId); // Remove from active map
                    // For a web interface, it's often better to let the user initiate a new request.
                    // If you need automatic retries, implement a retry counter here.
                } else if (lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode === 401) {
                    // Authentication failed (e.g., session invalidated from WhatsApp side)
                    console.log(`[${sessionId}] Authentication failed, removing session:`, lastDisconnect.error);
                    removeFile(sessionDirPath); // Remove the invalid session files
                    activeBaileysSessions.delete(sessionId);
                    // This error occurs after the initial response is sent, so no new HTTP response.
                    // Log this to your system for monitoring.
                } else {
                    // Other unexpected connection closures
                    console.log(`[${sessionId}] Connection closed for unknown reason:`, lastDisconnect);
                    removeFile(sessionDirPath);
                    activeBaileysSessions.delete(sessionId);
                }
            }
        });

        // --- Session Timeout ---
        // Set a timeout to automatically close and clean up sessions that don't connect
        // within a specified duration (e.g., 2 minutes). This prevents hanging processes.
        setTimeout(() => {
            if (activeBaileysSessions.has(sessionId)) {
                console.log(`[${sessionId}] Session timed out. Closing connection and cleaning up.`);
                const sockToClose = activeBaileysSessions.get(sessionId);
                sockToClose.ws.close();
                removeFile(sessionDirPath);
                activeBaileysSessions.delete(sessionId);
            }
        }, 120 * 1000); // 2 minutes (120 seconds) timeout for connection

    } catch (err) {
        // Catch any unhandled errors during the initial session setup
        console.error(`[${sessionId}] Unhandled ERROR during session initialization:`, err);
        removeFile(sessionDirPath); // Ensure cleanup on early errors
        activeBaileysSessions.delete(sessionId); // Remove from map
        // If an error occurs before the initial response, send a 500 status
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: "❗ An unexpected server error occurred during session setup. Please try again." });
        }
    }
}

// --- Express Route for Pair Code Request ---
router.post('/', async (req, res) => {
    const sessionId = makeid(); // Generate a unique session ID for this request
    const { phoneNumber } = req.body; // Get the phone number from the request body

    // Basic validation for the phone number
    if (!phoneNumber) {
        return res.status(400).json({ success: false, message: "Phone number is required." });
    }
    const cleanPhoneNumber = phoneNumber.replace(/[^0-9]/g, ''); // Remove non-numeric characters

    // Start the Baileys session initialization process
    initializeBaileysSession(sessionId, cleanPhoneNumber, res);
});

// Export the router to be used by server.js
module.exports = router;
