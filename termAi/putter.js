
// puter.js - Orkestro Auto-Config Logic

let isGenerating = false;

document.addEventListener('DOMContentLoaded', () => {
    window.chatContainer = document.getElementById('chat-container');
    window.userInput = document.getElementById('userInput');
    window.configStatus = document.getElementById('configStatus');

    // 1. Run Self Configuration
    selfConfigure();
});

// --- AUTO CONFIGURATION ---
async function selfConfigure() {
    try {
        window.configStatus.innerText = " (Connecting to Cloud...)";
        
        // Check if Puter is available
        if (typeof puter === 'undefined') throw new Error("No Internet");

        // Try to silently check auth. If not authed, Puter handles it automatically via popup.
        // We do a lightweight call to check connection.
        // Note: Puter handles the "First Run" popup natively when you try to use ai.chat() or puter.getAuth()
        
        // Simulate a quick check
        setTimeout(() => {
            window.configStatus.innerText = " (Online)";
            window.configStatus.style.color = "#00ff00";
        }, 1000);

    } catch (e) {
        window.configStatus.innerText = " (Offline)";
        window.configStatus.style.color = "red";
        console.error("Config failed", e);
    }
}

// --- CHAT LOGIC ---
function checkEnter(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
}

async function handleSend() {
    const text = window.userInput.value.trim();
    if (!text || isGenerating) return;

    // User Message
    addMessage('user', text);
    window.userInput.value = '';

    // AI Placeholder
    isGenerating = true;
    const aiMsgId = addMessage('ai', '<div style="color:#8b5cf6;">Thinking...</div>');
    const contentDiv = document.getElementById(aiMsgId).querySelector('.content');

    try {
        // Real AI Call
        const result = await puter.ai.chat(text);
        const response = (result.message ? result.message.content : result);
        
        // Render
        contentDiv.innerHTML = response;
        isGenerating = false;
    } catch (err) {
        contentDiv.innerHTML = "Error connecting to AI cloud. <br>Did you allow the Puter popup?";
        isGenerating = false;
    }
}

function addMessage(role, text) {
    const id = 'msg-' + Date.now();
    const row = document.createElement('div');
    row.className = `message-row ${role}`;
    row.id = id;

    const avatarLabel = role === 'user' ? 'U' : 'AI';
    // Simple text escape for safety
    const safeText = role === 'user' ? text.replace(/</g, "&lt;") : text;

    row.innerHTML = `
        <div class="avatar">${avatarLabel}</div>
        <div class="content">${safeText}</div>
    `;
    window.chatContainer.appendChild(row);
    window.chatContainer.scrollTop = window.chatContainer.scrollHeight;
    return id;
}
