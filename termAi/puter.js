// puter.js - Complete Logic

let isGenerating = false;
let currentModel = 'gpt-4o'; // Default Model
const models = ['gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet'];

document.addEventListener('DOMContentLoaded', () => {
    window.chatContainer = document.getElementById('chat-container');
    window.userInput = document.getElementById('userInput');
    window.configStatus = document.getElementById('configStatus');
    
    // Start Auto-Configuration
    selfConfigure();
});

// --- CONFIGURATION ---
function selfConfigure() {
    if (typeof puter !== 'undefined') {
        window.configStatus.innerText = " (Online)";
        window.configStatus.style.color = "#00ff00";
    } else {
        window.configStatus.innerText = " (Connecting...)";
        window.configStatus.style.color = "orange";
        setTimeout(selfConfigure, 1000);
    }
}

// --- MODEL SWITCHING ---
function cycleModel() {
    let idx = models.indexOf(currentModel);
    currentModel = models[(idx + 1) % models.length];
    
    const btn = document.getElementById('modelBtn');
    if(btn) {
        btn.innerText = currentModel;
        btn.style.borderColor = '#fff';
        setTimeout(() => btn.style.borderColor = '#8b5cf6', 200);
    }
}

// --- HANDLERS ---
function checkEnter(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
}

async function handleSend() {
    const text = window.userInput.value.trim();
    if (!text || isGenerating) return;

    // 1. Add User Message
    addMessage('user', text);
    window.userInput.value = '';

    // Lock
    isGenerating = true;

    // 2. Create Empty AI Bubble
    const aiMsgId = addMessage('ai', ''); 
    const contentDiv = document.getElementById(aiMsgId).querySelector('.content');

    // 3. Show Typing Indicator
    contentDiv.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';

    try {
        // 4. Call AI with Selected Model
        const result = await puter.ai.chat(text, { model: currentModel });
        
        // Extract Text
        const response = (result.message && result.message.content) ? result.message.content : result;

        // 5. Start Typing Effect
        streamText(contentDiv, response);

    } catch (err) {
        console.error(err);
        contentDiv.innerHTML = "<span style='color:red'>Error: Connection lost. Please reload.</span>";
        isGenerating = false;
    }
}

// --- PHYSICAL TYPING EFFECT ---
function streamText(element, fullText) {
    element.innerHTML = ''; // Clear dots
    let i = 0;
    const speed = 20; // ms per letter

    function typeChar() {
        if (i < fullText.length) {
            element.textContent += fullText.charAt(i);
            window.chatContainer.scrollTop = window.chatContainer.scrollHeight;
            i++;
            setTimeout(typeChar, speed);
        } else {
            isGenerating = false;
        }
    }
    typeChar();
}

// --- DOM HELPER ---
function addMessage(role, text) {
    const id = 'msg-' + Date.now();
    const row = document.createElement('div');
    row.className = `message-row ${role}`;
    row.id = id;

    const avatarLabel = role === 'user' ? 'U' : 'AI';
    
    // Escape HTML for User
    let safeText = text;
    if (role === 'user') {
        safeText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, '<br>');
    }

    row.innerHTML = `
        <div class="avatar">${avatarLabel}</div>
        <div class="content">${safeText}</div>
    `;
    
    window.chatContainer.appendChild(row);
    window.chatContainer.scrollTop = window.chatContainer.scrollHeight;
    return id;
}

