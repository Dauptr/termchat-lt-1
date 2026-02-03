// putter.js - Contains the logic for the OmniChat Application

// --- GLOBAL VARIABLES ---
let isGenerating = false;
let messageCount = 0;

// --- DOM REFERENCES ---
// We wait for DOMContentLoaded to ensure HTML is ready before finding elements
document.addEventListener('DOMContentLoaded', () => {
    // Initialize references
    window.chatContainer = document.getElementById('chat-container');
    window.userInput = document.getElementById('userInput');
    window.sendBtn = document.getElementById('sendBtn');
    window.debugPanel = document.getElementById('debug-panel');

    // Log start
    log("putter.js loaded successfully.");
});

// --- DEBUG LOGGER ---
function log(msg, isError = false) {
    const time = new Date().toLocaleTimeString();
    const color = isError ? 'var(--error)' : '#0f0';
    
    // Check if panel exists yet (for very early logs)
    if (window.debugPanel) {
        window.debugPanel.innerHTML += `<div style="color:${color}">[${time}] ${msg}</div>`;
        window.debugPanel.scrollTop = window.debugPanel.scrollHeight;
    }
    
    console.log(`[Putter]: ${msg}`);
}

// --- INPUT HANDLING ---
function checkEnter(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
}

// --- FORCE RESET ---
function forceReset() {
    log("USER: Force Reset Triggered", true);
    isGenerating = false;
    window.userInput.disabled = false;
    window.userInput.value = "";
    log("System reset.");
}

// --- CORE SEND LOGIC ---
function handleSend() {
    try {
        log("Step 1: Send Triggered");
        
        const text = window.userInput.value.trim();
        
        if (!text) {
            log("Warning: Empty input detected");
            return;
        }

        if (isGenerating) {
            log("Warning: System busy. Generating in progress.", true);
            return;
        }

        // 1. Process User Message
        log("Step 2: Creating User Message");
        const userMsgId = addMessage('user', text);
        
        if (!document.getElementById(userMsgId)) {
            throw new Error("Failed to append user message to DOM.");
        }

        // Clear Input
        window.userInput.value = '';
        window.userInput.style.height = '24px';

        // 2. Process AI Response
        isGenerating = true;
        log("Step 3: Processing AI Response");

        const aiMsgId = addMessage('ai', '');
        const contentDiv = document.getElementById(aiMsgId).querySelector('.content');

        if (!contentDiv) {
            throw new Error("Could not find AI content container.");
        }

        // Show Typing Dots
        contentDiv.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';

        // Simulate Network Delay & Generate Response
        setTimeout(() => {
            log("Step 4: Generating Text Stream...");
            const response = generateResponse(text);
            streamText(contentDiv, response);
        }, 1000);

    } catch (error) {
        log("CRITICAL ERROR: " + error.message, true);
        isGenerating = false; // Unstick system
        alert("Error in putter.js: " + error.message);
    }
}

// --- GENERATOR (SIMULATED AI) ---
function generateResponse(input) {
    // In a real app, this is where you would call fetch() to an API
    const responses = [
        "I received your input: " + input,
        "Putter.js confirms: Data processed successfully.",
        "That is an interesting point.",
        "Simulating thought process... Complete.",
        "I am running locally on your device via putter.js."
    ];
    
    // Pick a random response
    return responses[Math.floor(Math.random() * responses.length)];
}

// --- DOM MANIPULATION: ADD MESSAGE ---
function addMessage(role, text) {
    messageCount++;
    const id = 'msg-' + messageCount;
    
    log(`Building DOM: ID ${id}, Role ${role}`);

    const row = document.createElement('div');
    row.className = `message-row ${role}`;
    row.id = id;

    const avatarLabel = role === 'user' ? 'U' : 'AI';
    
    // Simple escape of HTML for user input
    const safeText = role === 'user' 
        ? text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, '<br>') 
        : '';

    row.innerHTML = `
        <div class="avatar">${avatarLabel}</div>
        <div class="content">${safeText}</div>
    `;

    window.chatContainer.appendChild(row);
    window.chatContainer.scrollTop = window.chatContainer.scrollHeight;

    return id;
}

// --- DOM MANIPULATION: TYPEWRITER EFFECT ---
function streamText(element, fullText) {
    try {
        element.innerHTML = ''; // Clear dots
        let i = 0;
        
        const interval = setInterval(() => {
            element.textContent += fullText.charAt(i);
            window.chatContainer.scrollTop = window.chatContainer.scrollHeight;
            i++;

            if (i >= fullText.length) {
                clearInterval(interval);
                isGenerating = false;
                log("Step 5: Output Complete.");
            }
        }, 30); // Typing speed

    } catch (error) {
        log("Typing Error: " + error.message, true);
        isGenerating = false;
    }
}
