const API_MODEL = "llama-3.3-70b-versatile";
let GROQ_API_KEY = localStorage.getItem('termos_groq_key') || ""; // Reuse TermOS Key

// Elements
const codeArea = document.getElementById('code-area');
const chatHistory = document.getElementById('chat-history');
const acceptBar = document.getElementById('accept-bar');
const suggestionCursor = document.getElementById('suggestion-cursor');
const previewContent = document.getElementById('preview-content');
const userInput = document.getElementById('user-input');
const apiDot = document.getElementById('api-status-dot');
const lineNumbers = document.getElementById('line-numbers');

let ghostCode = null;

// --- Initialization ---
window.addEventListener('load', () => {
    updateLineNumbers();
    updateStatusDot();
});

// --- Interaction ---
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleRequest();
    }
});

// Listen for typing in editor
codeArea.addEventListener('input', () => {
    cancelSuggestion();
    updateLineNumbers();
});

// Listen for Tab key in editor to accept suggestion
codeArea.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && ghostCode) {
        e.preventDefault();
        acceptSuggestion();
    }
    // If user types, cancel suggestion
    if (ghostCode && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        cancelSuggestion();
    }
});

function handleRequest() {
    const text = userInput.value.trim();
    if (!text) return;

    addMessage(text, 'user');
    userInput.value = '';

    // Show typing indicator in chat
    const typingId = "typing-" + Date.now();
    const typingDiv = document.createElement('div');
    typingDiv.id = typingId;
    typingDiv.className = "msg-ai";
    typingDiv.innerHTML = `<div class="msg-icon">...</div><div class="msg-content">Thinking...</div>`;
    chatHistory.appendChild(typingDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    // Logic: Use Real AI if key exists, else use Mock
    if (GROQ_API_KEY) {
        fetchCopilot(text, typingId);
    } else {
        // Fallback to local mock if no API key
        setTimeout(() => {
            document.getElementById(typingId)?.remove();
            const response = generateCodeMock(text);
            addMessage(response.msg, 'ai');
            injectGhostText(response.code);
        }, 600);
    }
}

async function fetchCopilot(prompt, typingId) {
    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { 
                "Authorization": `Bearer ${GROQ_API_KEY}`, 
                "Content-Type": "application/json" 
            },
            body: JSON.stringify({
                model: API_MODEL,
                messages: [
                    { role: "system", content: "You are an expert front-end developer. Provide ONLY raw HTML/CSS code snippets. No markdown, no explanation, just the code snippet." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.5,
                max_tokens: 1024
            })
        });

        const data = await response.json();
        const aiCode = data.choices[0].message.content;
        
        document.getElementById(typingId)?.remove();
        addMessage(`Generated code for: ${prompt}`, 'ai');
        injectGhostText(aiCode);

    } catch (err) {
        document.getElementById(typingId)?.remove();
        addMessage("Error: " + err.message, 'ai');
    }
}

function addMessage(text, sender) {
    const div = document.createElement('div');
    div.className = `msg-${sender}`;

    if (sender === 'user') {
        div.innerText = text;
    } else {
        // Apply syntax highlighting to chat messages too!
        div.innerHTML = `<div class="msg-icon">AI</div><div class="msg-content">${highlightSyntax(text)}</div>`;
    }
    chatHistory.appendChild(div);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

// --- Syntax Highlighting Helper ---
// Simple regex highlighter for Ghost Text
function highlightSyntax(html) {
    // Escape HTML first to prevent rendering
    let safe = html.replace(/&/g, "&amp;")
                   .replace(/</g, "&lt;")
                   .replace(/>/g, "&gt;");

    // Highlight Tags <tag>
    safe = safe.replace(/(&lt;\/?)(\w+)(.*?)(\/?&gt;)/g, '<span class="token-tag">$1$2$3$4</span>');
    
    // Highlight Attributes attribute="value"
    safe = safe.replace(/(\s)(\w+)(=)/g, '$1<span class="token-attr">$2</span>$3');

    // Highlight Strings "value"
    safe = safe.replace(/(=)(&quot;.*?&quot;)/g, '$1<span class="token-val">$2</span>');

    return safe;
}

// --- Copilot Suggestion Logic ---
function injectGhostText(code) {
    ghostCode = code;

    // Create a span for ghost text
    const span = document.createElement('span');
    span.className = 'ghost-text';
    span.id = 'ghost-suggestion';
    // Apply syntax highlight to the ghost text too!
    span.innerHTML = highlightSyntax(code);

    // Insert it after the cursor marker
    suggestionCursor.appendChild(span);

    // Show the "Tab to Accept" bar
    acceptBar.style.display = 'flex';

    // Auto scroll to bottom
    codeArea.scrollTop = codeArea.scrollHeight;
}

function acceptSuggestion() {
    if (!ghostCode) return;

    // Get the ghost span
    const ghostSpan = document.getElementById('ghost-suggestion');

    if (ghostSpan) {
        // Convert ghost span to normal text
        ghostSpan.classList.remove('ghost-text');
        ghostSpan.classList.add('accepted-code');
        ghostSpan.style.fontStyle = "normal";
        ghostSpan.style.opacity = "1";
        ghostSpan.style.background = "none";
    }

    // Clear state
    ghostCode = null;
    acceptBar.style.display = 'none';
    
    updateLineNumbers();
    runPreview();
}

function cancelSuggestion() {
    const ghostSpan = document.getElementById('ghost-suggestion');
    if (ghostSpan) ghostSpan.remove();
    ghostCode = null;
    acceptBar.style.display = 'none';
}

function runPreview() {
    let html = codeArea.innerText;
    // Clean up any escaped text from highlighter
    html = html.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&amp;/g, "&");
    
    previewContent.innerHTML = html;
    document.getElementById('preview-modal').style.display = 'block';
}

function togglePreview() {
    runPreview();
    const modal = document.getElementById('preview-modal');
    modal.style.display = modal.style.display === 'none' ? 'block' : 'none';
}

// --- Utilities ---

function updateLineNumbers() {
    // Count newlines
    const text = codeArea.innerText;
    const count = (text.match(/\n/g) || []).length + 1;
    
    // Generate HTML for numbers
    lineNumbers.innerHTML = Array.from({length: count}, (_, i) => i + 1).join('<br>');
}

function updateStatusDot() {
    if(GROQ_API_KEY) {
        apiDot.style.background = "#10b981"; // Green
        apiDot.style.boxShadow = "0 0 5px #10b981";
    } else {
        apiDot.style.background = "#ffbd2e"; // Orange
    }
}

// --- Mock Logic (Fallback if no API Key) ---
function generateCodeMock(input) {
    const lower = input.toLowerCase();

    if (lower.includes('button')) {
        return {
            msg: "Generating a standard HTML button component.",
            code: `<br><br><button style="padding:10px 20px; background:blue; color:white; border:none; border-radius:4px;">Click Me</button>`
        };
    }
    if (lower.includes('card')) {
        return {
            msg: "Creating a Bootstrap-style card.",
            code: `<br><br><div style="border:1px solid #ddd; padding:20px; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.1);"><h3 style="margin:0 0 10px 0;">Card Title</h3><p style="margin:0; color:#666;">Content here...</p></div>`
        };
    }
    if (lower.includes('header') || lower.includes('nav')) {
         return {
            msg: "Building a navigation bar.",
            code: `<br><br><nav style="background:#333; padding:10px; display:flex; gap:20px;"><a href="#" style="color:white; text-decoration:none;">Home</a><a href="#" style="color:white; text-decoration:none;">About</a></nav>`
        };
    }
    return {
        msg: "I can write HTML, CSS, or JavaScript. Try asking for a 'button' or 'card'.",
        code: `<!-- Waiting for prompt -->`
    };
}
