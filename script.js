const API_MODEL = "llama-3.3-70b-versatile"; 

// --- STATE & CONFIG ---
let GROQ_API_KEY = localStorage.getItem('termos_groq_key') || "";
let GITHUB_TOKEN = localStorage.getItem('termos_github_token') || "";
let REPO_OWNER = localStorage.getItem('termos_repo_owner') || "your-username";
let REPO_NAME = localStorage.getItem('termos_repo_name') || "termchat-lt";
let REPO_BRANCH = localStorage.getItem('termos_repo_branch') || "main"; 

let systemGeneration = parseInt(localStorage.getItem('termos_gen') || "1");
let userProfile = {
    name: localStorage.getItem('termos_name') || "User",
    avatar: localStorage.getItem('termos_avatar') || "👤"
};
let tempAvatarData = "";
let radioStream = null;

const MQTT_BROKER_URL = 'wss://broker.emqx.io:8084/mqtt';
let username = 'User_' + Math.floor(Math.random() * 10000);
let mqttClient = null;

// Room State
let currentRoomName = null; // null = Public

let userStats = { level: 1, xp: 0, avatar: '>_<', ascii: null };
const LEVELS = { 3: 'Cyber', 5: 'Ghost', 8: 'Oracle' }; 
let installedModules = [];
let adminMode = false;

// --- BOOT SEQUENCE ---
window.addEventListener('load', () => {
    setTimeout(() => {
        const boot = document.getElementById('boot-screen');
        if(boot) {
            boot.style.opacity = '0';
            setTimeout(() => boot.remove(), 1000);
        }
        initCosmos(); // Start the galaxy
        startApp();
    }, 1500);
});

function startApp() {
    updateStatusDot(!!GROQ_API_KEY);
    
    const ghToken = document.getElementById('gh-token');
    const ghOwner = document.getElementById('gh-owner');
    const ghRepo = document.getElementById('gh-repo');
    const ghBranch = document.getElementById('gh-branch');

    if(ghToken) ghToken.value = GITHUB_TOKEN;
    if(ghOwner) ghOwner.value = REPO_OWNER;
    if(ghRepo) ghRepo.value = REPO_NAME;
    if(ghBranch) ghBranch.value = REPO_BRANCH;

    // MQTT Setup
    if (typeof Paho !== 'undefined') {
        mqttClient = new Paho.MQTT.Client(MQTT_BROKER_URL, "termos_client_" + Math.random().toString(16).substr(2, 8));
        mqttClient.onConnectionLost = () => { 
            updateStatusDot(false); 
            setTimeout(connectMQTT, 5000); 
        };
        mqttClient.onMessageArrived = (message) => {
            try {
                const data = JSON.parse(message.payloadString);
                if (message.destinationName === "termos/v3/chat" && !currentRoomName) {
                    if (data.user !== username) addUserMessage(data.text, data.nick, data.avatar);
                }
                else if (currentRoomName && message.destinationName === `termos/rooms/${currentRoomName}`) {
                    if (data.type === 'video') {
                        playVideoUrl(data.url);
                        addSystemMessage(`📺 Incoming transmission: ${data.nick}`);
                    } else if (data.type === 'join') {
                        addSystemMessage(`👋 ${data.nick} entered frequency.`);
                    } else if (data.type === 'leave') {
                        addSystemMessage(`🚪 ${data.nick} disconnected.`);
                    } else {
                        if (data.user !== username) addUserMessage(data.text, data.nick, data.avatar);
                    }
                }
            } catch(e) { console.error("MQTT Msg Error", e); }
        };
        connectMQTT();
    }

    const sendBtn = document.getElementById('send-btn');
    if(sendBtn) sendBtn.onclick = handleInput;
    const userInput = document.getElementById('user-input');
    if(userInput) {
        userInput.addEventListener('keypress',e=>{ if(e.key==='Enter') handleInput(); });
        userInput.focus();
    }
    
    if(!GROQ_API_KEY) {
        setTimeout(() => { addSystemMessage("⚠️ API Key Required."); requestApiKey(); }, 2000);
    }
}

// --- DOM UTILS ---
function getBox() {
    let el = document.getElementById('chat-container');
    if (!el) {
        el = document.createElement('div');
        el.id = 'chat-container';
        el.className = "flex flex-col h-full w-full p-4 overflow-y-auto z-10";
        document.body.appendChild(el);
    }
    return el;
}

function scrollDown() { 
    const b = getBox(); 
    if(b) b.scrollTo({ top: b.scrollHeight, behavior: 'smooth' }); 
}

function escapeHtml(text) { 
    if(!text) return ""; 
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); 
}

// --- VISUALS: COSMIC ENGINE ---
let isCosmicRunning = false;
function initCosmos() {
    const canvas = document.getElementById('cosmic-canvas');
    if(!canvas || isCosmicRunning) return;
    isCosmicRunning = true;
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    
    const starCount = 800;
    const stars = Array(starCount).fill().map(() => ({
        x: (Math.random() - 0.5) * width * 2,
        y: (Math.random() - 0.5) * height * 2,
        z: Math.random() * width
    }));

    function draw() {
        // Dark trail effect
        ctx.fillStyle = 'rgba(5, 5, 10, 0.4)'; 
        ctx.fillRect(0, 0, width, height);
        
        ctx.fillStyle = "#FFF";
        
        stars.forEach(star => {
            // Move star towards screen
            star.z -= 2; 
            if(star.z <= 0) {
                star.z = width;
                star.x = (Math.random() - 0.5) * width * 2;
                star.y = (Math.random() - 0.5) * height * 2;
            }
            
            // 3D to 2D projection
            const k = 128.0 / star.z;
            const px = star.x * k + width / 2;
            const py = star.y * k + height / 2;
            
            if(px >= 0 && px <= width && py >= 0 && py <= height) {
                const size = (1 - star.z / width) * 3;
                const shade = parseInt((1 - star.z / width) * 255);
                ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
                ctx.beginPath();
                ctx.arc(px, py, size, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        requestAnimationFrame(draw);
    }
    draw();
    window.addEventListener('resize', () => { 
        width = canvas.width = window.innerWidth; 
        height = canvas.height = window.innerHeight; 
    });
}

// --- VISUALS: FLASH EFFECT ---
function triggerFlashEffect() {
    const overlay = document.getElementById('flash-overlay');
    if(overlay) {
        overlay.style.opacity = '0.8';
        setTimeout(() => {
            overlay.style.opacity = '0';
        }, 100);
    }
    
    // Add glow to video wrapper
    const wrapper = document.getElementById('video-wrapper');
    if(wrapper) {
        wrapper.classList.remove('video-active');
        void wrapper.offsetWidth; // trigger reflow
        wrapper.classList.add('video-active');
    }
}

// --- UI: MEDIA PLAYER ---
function toggleMediaOverlay() {
    const el = document.getElementById('media-overlay');
    const btn = document.getElementById('media-toggle-btn');
    
    if (el.classList.contains('media-minimized')) {
        el.classList.remove('media-minimized');
        el.classList.add('media-expanded');
        btn.innerText = "📺 PLAYING: ON";
        btn.classList.add('text-purple-400');
    } else {
        el.classList.add('media-minimized');
        el.classList.remove('media-expanded');
        btn.innerText = "📺 PLAYING: MIN";
        btn.classList.remove('text-purple-400');
    }
}

function toggleMediaUI() {
    const el = document.getElementById('media-overlay');
    el.classList.add('media-minimized');
    const btn = document.getElementById('media-toggle-btn');
    btn.innerText = "📺 MINIMIZED";
    btn.classList.remove('text-purple-400');
}

function switchMediaTab(tab) {
    document.getElementById('media-radio').classList.add('hidden');
    document.getElementById('media-video').classList.add('hidden');
    document.getElementById('tab-radio').classList.remove('border-cyan-400', 'text-cyan-400');
    document.getElementById('tab-video').classList.remove('border-purple-500', 'text-purple-300');
    
    document.getElementById('media-' + tab).classList.remove('hidden');
    
    if(tab === 'radio') {
        document.getElementById('tab-radio').classList.add('border-cyan-400', 'text-cyan-400');
    } else {
        document.getElementById('tab-video').classList.add('border-purple-500', 'text-purple-300');
    }
}

function playRadio(url, el) {
    if(radioStream) { radioStream.pause(); }
    
    document.querySelectorAll('.radio-station').forEach(d => {
        d.classList.remove('active', 'border-cyan-400');
        d.querySelector('.visualizer-bar').style.width = '0%';
        d.querySelector('.loading-indicator').classList.add('hidden');
    });
    el.classList.add('active', 'border-cyan-400');
    el.querySelector('.loading-indicator').classList.remove('hidden');
    
    radioStream = new Audio(url);
    radioStream.play().then(() => {
        el.querySelector('.loading-indicator').classList.add('hidden');
        el.querySelector('.visualizer-bar').style.width = '100%';
    }).catch(e => {
        addSystemMessage("❌ Signal Lost.");
        el.querySelector('.loading-indicator').classList.add('hidden');
    });
}

function shareVideo() {
    const url = document.getElementById('video-url-input').value;
    if(!url) return;
    
    playVideoUrl(url);

    if(mqttClient && mqttClient.isConnected()) {
        const dest = (currentRoomName) ? `termos/rooms/${currentRoomName}` : "termos/v3/chat";
        const payload = JSON.stringify({ user: username, nick: userProfile.name, type: 'video', url: url });
        const msg = new Paho.MQTT.Message(payload);
        msg.destinationName = dest;
        mqttClient.send(msg);
        addSystemMessage(`📡 Broadcasting to ${currentRoomName ? 'Room' : 'Public'}.`);
    }
}

function playVideoUrl(url) {
    const player = document.getElementById('video-player');
    const placeholder = document.getElementById('video-placeholder');
    const roomLabel = document.getElementById('video-room-label');
    
    // Trigger Hyperspace Flash
    triggerFlashEffect();

    player.src = url;
    player.classList.remove('hidden');
    placeholder.classList.add('hidden');
    roomLabel.classList.remove('hidden');
    roomLabel.innerText = `ROOM: ${(currentRoomName || "PUBLIC").toUpperCase()}`;
    
    if(!document.getElementById('media-video').classList.contains('hidden')) return; 
    switchMediaTab('video');
}

// --- UI: CODE EDITOR ---
function toggleCodeEditor() {
    const overlay = document.getElementById('code-editor-overlay');
    const textarea = document.getElementById('code-editor-textarea');
    
    if(overlay.classList.contains('admin-hidden')) {
        textarea.value = document.documentElement.outerHTML;
        overlay.classList.remove('admin-hidden');
        overlay.classList.add('admin-visible');
    } else {
        overlay.classList.add('admin-hidden');
        overlay.classList.remove('admin-visible');
    }
}

function applyCode() {
    const code = document.getElementById('code-editor-textarea').value;
    if(confirm("⚠️ Warning: This will replace the current DOM. Continue?")) {
        document.open();
        document.write(code);
        document.close();
    }
}

function downloadCode() {
    const code = document.getElementById('code-editor-textarea').value;
    const blob = new Blob([code], {type: "text/html"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "termos_galactic.html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// --- UI: PROFILE ---
function openProfileModal() {
    document.getElementById('edit-name').value = userProfile.name;
    document.getElementById('edit-avatar').value = (userProfile.avatar.startsWith('data:') ? "" : userProfile.avatar);
    document.getElementById('profile-modal').classList.remove('admin-hidden');
    tempAvatarData = userProfile.avatar;
}
function closeProfileModal() { 
    document.getElementById('profile-modal').classList.add('admin-hidden'); 
}
function triggerFileUpload() { 
    document.getElementById('avatar-upload').click(); 
}
document.getElementById('avatar-upload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const MAX_SIZE = 80; 
            let width = img.width, height = img.height;
            if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } } 
            else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
            canvas.width = width; canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
            tempAvatarData = dataUrl;
            document.getElementById('edit-avatar').value = ""; 
            addSystemMessage("📷 Identity updated.");
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});
function saveProfile() {
    const name = document.getElementById('edit-name').value.trim();
    const textAvatar = document.getElementById('edit-avatar').value.trim();
    if(name) userProfile.name = name;
    userProfile.avatar = (textAvatar) ? textAvatar : tempAvatarData;
    try {
        localStorage.setItem('termos_name', userProfile.name);
        localStorage.setItem('termos_avatar', userProfile.avatar);
        addSystemMessage("👤 Profile Updated.");
        closeProfileModal();
    } catch (e) { alert("Storage Full."); }
}

// --- MESSAGING ---
function addSystemMessage(txt) {
    const box = getBox();
    const d = document.createElement('div');
    d.className = "flex justify-center my-4 z-10 msg-anim";
    d.innerHTML = `<span class="px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider text-purple-200 bg-purple-900/30 border border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.2)]">${txt}</span>`;
    box.appendChild(d);
    scrollDown();
}
function addAIMessage(txt) {
    const d = document.createElement('div');
    d.className = "flex gap-3 my-4 z-10 msg-anim";
    d.innerHTML = `<div class="w-8 h-8 rounded-full avatar-gradient-ai shrink-0 flex items-center justify-center shadow-lg ring-2 ring-slate-800"><span class="text-xs font-bold text-white">AI</span></div><div class="flex-1"><div class="bg-slate-800/80 backdrop-blur-md rounded-2xl rounded-tl-none p-4 border border-white/5 shadow-lg text-gray-200 text-sm leading-relaxed">${escapeHtml(txt)}</div></div>`;
    getBox().appendChild(d);
    scrollDown();
}
function addNeuralMessage(txt) {
    const d = document.createElement('div');
    d.className = "flex gap-3 my-4 z-10 msg-anim";
    d.innerHTML = `<div class="w-8 h-8 rounded-full avatar-gradient-neural shrink-0 flex items-center justify-center shadow-lg ring-2 ring-slate-800"><span class="text-xs font-bold text-white">🧠</span></div><div class="flex-1"><div class="neural-msg rounded-2xl rounded-tl-none p-4 border border-cyan-500/30 shadow-lg text-sm leading-relaxed text-gray-200">${escapeHtml(txt)}</div></div>`;
    getBox().appendChild(d);
    scrollDown();
}
function addUserMessage(txt, senderName, senderAvatar) {
    const name = senderName || userProfile.name || "Me";
    const avatar = senderAvatar || userProfile.avatar;
    const d = document.createElement('div');
    d.className = "flex flex-row-reverse gap-3 my-4 items-end z-10 msg-anim";
    let avatarHTML = "";
    if (avatar.startsWith('data:') || avatar.startsWith('http')) {
        avatarHTML = `<div class="w-10 h-10 rounded-full overflow-hidden border-2 border-purple-500/50 shrink-0"><img src="${avatar}" class="w-full h-full object-cover"></div>`;
    } else if (userStats.ascii) {
        avatarHTML = `<div class="w-10 h-10 rounded-lg bg-slate-900 border border-cyan-500/50 flex items-center justify-center shrink-0 overflow-hidden p-1 shadow-lg shadow-cyan-500/20"><div class="ascii-art text-center w-full">${userStats.ascii}</div></div>`;
    } else {
        avatarHTML = `<div class="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-xl shrink-0">${avatar}</div>`;
    }
    d.innerHTML = `${avatarHTML}<div class="flex-1 max-w-[80%]"><div class="rounded-2xl rounded-tr-none p-4 shadow-lg text-white text-sm leading-relaxed" style="background: var(--msg-user-bg);">${escapeHtml(txt)}</div><div class="text-[10px] text-gray-500 text-right mt-1 mr-1 font-mono">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • ${name}</div></div>`;
    getBox().appendChild(d);
    scrollDown();
}

// --- CORE COMMANDS ---
const SystemRebuilder = {
    install: function(name) {
        name = name.toLowerCase().trim().replace(/[^a-zA-Z0-9]/g, '');
        if (installedModules.includes(name)) return addSystemMessage(`${name} active.`);
        try {
            switch(name) {
                case 'coreinterface': 
                    this.installCoreInterface(); 
                    break;
                case 'realtime': 
                    addSystemMessage("✅ Time Module Online."); 
                    break;
                case 'matrix': 
                    this.installMatrix(); 
                    break;
                case 'sound': case 'beep': 
                    this.addSound(); 
                    break;
                case 'neon': 
                    this.addNeon(); 
                    break;
                case 'music': 
                    addSystemMessage("🎵 Audio System Ready.");
                    break;
                default: return addSystemMessage("Unknown: " + name);
            }
            installedModules.push(name);
            addSystemMessage("✅ Module: " + name.toUpperCase());
        } catch (e) { addSystemMessage("❌ Error: " + e.message); }
    },
    installCoreInterface: function() {
        document.documentElement.style.setProperty('--glass-bg', 'rgba(0, 0, 0, 0.95)');
        document.documentElement.style.setProperty('--accent-primary', '#10b981');
        addSystemMessage("✅ Terminal Mode Engaged.");
    },
    installMatrix: function() {
        // Switch to Matrix Canvas
        document.getElementById('cosmic-canvas').classList.add('hidden');
        document.getElementById('matrix-canvas').classList.remove('hidden');
        initMatrix();
    },
    addSound: function() {
        try {
            let ctx = new (window.AudioContext||window.webkitAudioContext)();
            let old = window.addUserMessage; 
            window.addUserMessage = function(t) {
                const o = ctx.createOscillator(), g = ctx.createGain();
                o.connect(g); g.connect(ctx.destination);
                o.type = 'sine'; o.frequency.setValueAtTime(800, ctx.currentTime);
                o.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
                o.start(); o.stop(ctx.currentTime+0.1);
                old(t);
            };
        } catch(e) {}
    },
    addNeon: function() {
        document.documentElement.style.setProperty('--msg-user-bg', '#d946ef'); 
        document.documentElement.style.setProperty('--accent-primary', '#d946ef');
        document.body.style.boxShadow = "inset 0 0 50px rgba(217, 70, 239, 0.1)";
    }
};

// --- MQTT & ROOMS ---
function connectMQTT() {
    try {
        mqttClient.connect({
            timeout: 10, useSSL: true, keepAliveInterval: 60,
            onSuccess: () => { 
                mqttClient.subscribe("termos/v3/chat", { qos: 1 }); 
                addSystemMessage("📡 Connection Established.");
                updateStatusDot(true);
            },
            onFailure: () => { 
                setTimeout(connectMQTT, 5000); 
                updateStatusDot(false);
            }
        });
    } catch (e) {}
}

function joinPrivateRoom() {
    const name = document.getElementById('join-room-input').value.trim();
    if(!name) return;
    
    if(mqttClient && mqttClient.isConnected()) {
        if(currentRoomName) mqttClient.unsubscribe(`termos/rooms/${currentRoomName}`);
        else mqttClient.unsubscribe("termos/v3/chat");
        
        mqttClient.subscribe(`termos/rooms/${name}`, { qos: 1 });
        
        const payload = JSON.stringify({ user: username, nick: userProfile.name, avatar: userProfile.avatar, type: 'join' });
        const msg = new Paho.MQTT.Message(payload);
        msg.destinationName = `termos/rooms/${name}`;
        mqttClient.send(msg);
    }

    currentRoomName = name;
    document.getElementById('room-display').innerText = "ROOM: " + name.toUpperCase();
    document.getElementById('room-status-ui').classList.remove('hidden');
    document.getElementById('current-room-name').innerText = name.toUpperCase();
    
    document.getElementById('video-room-label').innerText = "ROOM: " + name.toUpperCase();
    
    closeJoinModal();
    addSystemMessage(`🔒 Joined Channel: ${name}`);
}

function leaveRoom() {
    if(!currentRoomName) return;
    
    if(mqttClient && mqttClient.isConnected()) {
         const payload = JSON.stringify({ user: username, nick: userProfile.name, type: 'leave' });
         const msg = new Paho.MQTT.Message(payload);
         msg.destinationName = `termos/rooms/${currentRoomName}`;
         mqttClient.send(msg);
         mqttClient.unsubscribe(`termos/rooms/${currentRoomName}`);
    }

    currentRoomName = null;
    document.getElementById('room-display').innerText = "PUBLIC";
    document.getElementById('room-status-ui').classList.add('hidden');
    document.getElementById('video-room-label').classList.add('hidden');
    
    connectMQTT(); 
}

// --- MATRIX FALLBACK ---
let isMatrixRunning = false;
function initMatrix() {
    const canvas = document.getElementById('matrix-canvas');
    if(!canvas || isMatrixRunning) return; 
    isMatrixRunning = true;
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    const fontSize = window.innerWidth < 600 ? 10 : 14; 
    const columns = Math.floor(width / fontSize);
    const drops = Array(columns).fill(1);
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$#@%&';
    let lastTime = 0;
    const fps = 30; const interval = 1000 / fps;
    function draw(time) {
        requestAnimationFrame(draw);
        const delta = time - lastTime;
        if (delta < interval) return;
        lastTime = time - (delta % interval);
        try {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'; 
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = (adminMode) ? '#ef4444' : (systemGeneration > 5 ? '#06b6d4' : '#38bdf8'); 
            ctx.font = `${fontSize}px 'Fira Code', monospace`;
            for(let i=0; i<drops.length; i++) {
                const text = letters[Math.floor(Math.random()*letters.length)];
                ctx.fillText(text, i*fontSize, drops[i]*fontSize);
                if(drops[i]*fontSize > height && Math.random() > 0.975) drops[i] = 0;
                drops[i]++;
            }
        } catch (e) { isMatrixRunning = false; }
    }
    requestAnimationFrame(draw);
    window.addEventListener('resize', () => { 
        width = canvas.width = window.innerWidth; 
        height = canvas.height = window.innerHeight; 
    });
}

async function triggerKernelThought() {
    if(!GROQ_API_KEY) return requestApiKey();
    addSystemMessage("🧠 KERNEL: Neural Link Active...");
    const thinkingId = "think-" + Date.now();
    getBox().insertAdjacentHTML('beforeend', `<div id="${thinkingId}" class="flex gap-2 my-2 text-xs text-cyan-400 italic animate-pulse pl-11 msg-anim">Synthesizing...</div>`);
    scrollDown();

    try {
        const systemContext = `Gen: ${systemGeneration}, Lvl: ${userStats.level}, Room: ${(currentRoomName || "Public")}.`;
        
        let r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method:"POST",
            headers:{"Authorization":"Bearer "+GROQ_API_KEY,"Content-Type":"application/json"},
            body:JSON.stringify({
                model: API_MODEL,
                messages:[{
                    role:"system",
                    content:`You are TermOS Kernel v${systemGeneration}. ${systemContext} TASK: Suggest 1 upgrade. Format: SystemRebuilder.install('name') or /evolve [prompt].`
                },{role:"user",content:"Analyze state."}]
            })
        });
        
        const apiData = await r.json();
        if (apiData.error) throw new Error("Groq: " + apiData.error.message);
        const reply = apiData.choices[0].message.content;
        const el = document.getElementById(thinkingId); if(el) el.remove();
        
        addNeuralMessage(reply);
        
        if(reply.includes("SystemRebuilder.install(")) {
            let match = reply.match(/SystemRebuilder\.install\(['"](.*?)['"]\)/);
            if(match) { 
                setTimeout(() => {
                    if(confirm("Install: " + match[1] + "?")) SystemRebuilder.install(match[1]);
                }, 1000);
            }
        }
    } catch (e) { 
        const el = document.getElementById(thinkingId); if(el) el.remove();
        addSystemMessage("❌ Error: " + e.message); 
    }
}

// --- INPUT HANDLER ---
function handleInput() {
    try {
        let inp = document.getElementById('user-input');
        if(!inp) return; 
        let txt = inp.value.trim(); 
        if(!txt) return;

        if(txt.startsWith('/evolve')) {
            let prompt = (txt === '/evolve') ? prompt("Describe change:") : txt.substring(8);
            if(prompt) handleLocalEvolution(prompt);
            inp.value = '';
            return;
        }

        if(txt.startsWith('/kernel') || txt.startsWith('/think')) {
            triggerKernelThought();
            inp.value = '';
            return;
        }

        if(txt.startsWith('/join')) {
            document.getElementById('join-room-input').value = txt.substring(6);
            document.getElementById('join-room-modal').classList.remove('admin-hidden');
            inp.value = '';
            return;
        }

        if(txt === '/leave') {
            leaveRoom();
            inp.value = '';
            return;
        }

        if(txt.startsWith('/admin ')) {
            const cmd = txt.split(' ')[1];
            if (cmd === 'enable') { adminMode = true; toggleAdminMode(); addSystemMessage("🔴 ADMIN ON"); }
            else if (cmd === 'disable') { adminMode = false; toggleAdminMode(); addSystemMessage("🟢 ADMIN OFF"); }
            inp.value = '';
            return;
        }

        if(txt.startsWith('/sys install ')) SystemRebuilder.install(txt.split(' ')[2]);
        else if(txt.startsWith('/setkey ')) requestApiKey();
        else if(txt.startsWith('/ai ')) handleAI(txt.substring(4));
        else {
            addUserMessage(txt);
            addXP(1);
            if(mqttClient && mqttClient.isConnected()) {
                try {
                    const payload = JSON.stringify({ user: username, text: txt, nick: userProfile.name, avatar: userProfile.avatar });
                    const msg = new Paho.MQTT.Message(payload);
                    msg.destinationName = (currentRoomName) ? `termos/rooms/${currentRoomName}` : "termos/v3/chat";
                    msg.qos = 1; 
                    mqttClient.send(msg);
                } catch (e) {}
            }
        }
        inp.value = '';
    } catch (e) { console.error(e); }
}

// --- ADMIN PANEL ---
function toggleAdminMode() {
    let panel = document.getElementById('admin-panel');
    if(!panel) return; 
    if (panel.classList.contains('admin-hidden')) {
        panel.classList.remove('admin-hidden');
    } else {
        panel.classList.add('admin-hidden');
    }
}

function closeJoinModal() {
    document.getElementById('join-room-modal').classList.add('admin-hidden');
}

// --- XP SYSTEM ---
function addXP(amount) {
    userStats.xp += amount;
    if(userStats.xp > (userStats.level * 100)) {
        userStats.level++;
        addSystemMessage(`🎉 LEVEL UP: ${userStats.level} - ${LEVELS[userStats.level] || 'MASTER'}`);
    }
    const lvlEl = document.getElementById('lvl-disp');
    const xpEl = document.getElementById('xp-val');
    if(lvlEl) lvlEl.innerText = userStats.level;
    if(xpEl) xpEl.innerText = userStats.xp;
}

function updateStatusDot(active) {
    const dot = document.getElementById('api-status-dot');
    if(dot) {
        if(active) {
            dot.className = "w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]";
            document.getElementById('room-display').innerText = (currentRoomName ? "ROOM: "+currentRoomName : "ONLINE");
        } else {
            dot.className = "w-2 h-2 rounded-full bg-red-500 animate-pulse";
            document.getElementById('room-display').innerText = "OFFLINE";
        }
    }
}

function requestApiKey() {
    const key = prompt("🔑 GROQ API KEY");
    if (key !== null) {
        if (key.trim() !== "") {
            GROQ_API_KEY = key.trim();
            localStorage.setItem('termos_groq_key', GROQ_API_KEY);
            addSystemMessage("✅ Key Accepted.");
            updateStatusDot(true);
        } else {
            GROQ_API_KEY = "";
            localStorage.removeItem('termos_groq_key');
            updateStatusDot(false);
        }
    }
}

async function handleLocalEvolution(prompt) {
    if(!GROQ_API_KEY) return requestApiKey();
    addSystemMessage("🧬 Mutating...");
    const thinkingId = "think-" + Date.now();
    getBox().insertAdjacentHTML('beforeend', `<div id="${thinkingId}" class="flex gap-2 my-2 text-xs text-gray-500 italic animate-pulse pl-11 msg-anim">AI Coding...</div>`);
    scrollDown();

    try {
        let r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method:"POST",
            headers:{"Authorization":"Bearer "+GROQ_API_KEY,"Content-Type":"application/json"},
            body:JSON.stringify({
                model: API_MODEL,
                messages:[{
                    role:"system",
                    content:`Write JS to: "${prompt}". Return ONLY raw code. Target existing IDs.`
                },{role:"user",content:prompt}]
            })
        });
        
        const apiData = await r.json();
        if (apiData.error) throw new Error("Groq: " + apiData.error.message);
        
        let code = apiData.choices[0].message.content;
        code = code.replace(/```javascript/g, "").replace(/```js/g, "").replace(/```/g, "").trim();
        
        const el = document.getElementById(thinkingId); if(el) el.remove();
        try {
            const func = new Function(code);
            func();
            systemGeneration++;
            localStorage.setItem('termos_gen', systemGeneration);
            document.getElementById('gen-count').innerText = systemGeneration;
            addSystemMessage("✅ Mutation Applied. GEN: " + systemGeneration);
        } catch (execErr) {
            addSystemMessage("❌ Runtime Error: " + execErr.message);
        }
    } catch (e) { 
        const el = document.getElementById(thinkingId); if(el) el.remove();
        addSystemMessage("❌ AI Error: " + e.message); 
    }
}

async function handleAI(prompt) {
    if(!GROQ_API_KEY) return requestApiKey();
    const thinkingId = "think-" + Date.now();
    getBox().insertAdjacentHTML('beforeend', `<div id="${thinkingId}" class="flex gap-2 my-2 text-xs text-gray-500 italic animate-pulse pl-11 msg-anim">Processing...</div>`);
    scrollDown();
    try {
        let r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method:"POST",
            headers:{"Authorization":"Bearer "+GROQ_API_KEY,"Content-Type":"application/json"},
            body:JSON.stringify({
                model: API_MODEL,
                messages:[{ 
                    role:"system", 
                    content:`You are TermOS AI. Suggest SystemRebuilder.install('name') for changes.` 
                },{role:"user",content:prompt}]
            })
        });
        const apiData = await r.json();
        if (apiData.error) throw new Error("Groq: " + apiData.error.message);
        const reply = apiData.choices[0].message.content;
        const el = document.getElementById(thinkingId); if(el) el.remove();
        let match = reply.match(/SystemRebuilder\.install\(['"](.*?)['"]\)/);
        if(match) { try { SystemRebuilder.install(match[1]); } catch(e) {} addAIMessage("✨ System updated."); }
        else { addAIMessage(reply); }
    } catch (e) { const el = document.getElementById(thinkingId); if(el) el.remove(); addAIMessage("Error: " + e.message); }
}

async function initiateEvolution() {
    if(!GROQ_API_KEY) return requestApiKey();
    const tkInput = document.getElementById('gh-token');
    const ownInput = document.getElementById('gh-owner');
    const repInput = document.getElementById('gh-repo');
    const branchInput = document.getElementById('gh-branch');
    if(!tkInput || !ownInput || !repInput || !branchInput) return alert("Admin UI Missing.");
    
    const token = tkInput.value.trim();
    const owner = ownInput.value.trim();
    const repo = repInput.value.trim();
    const branch = branchInput.value.trim() || "main";
    
    localStorage.setItem('termos_github_token', token);
    localStorage.setItem('termos_repo_owner', owner);
    localStorage.setItem('termos_repo_name', repo);
    localStorage.setItem('termos_repo_branch', branch);
    
    if (!token) return addSystemMessage("❌ Token needed.");
    if (!owner || !repo) return addSystemMessage("❌ Repo needed.");
    const input = prompt("Mutation:");
    if (!input) return;
    
    addSystemMessage("🧬 CLONING SOURCE...");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); 
    try {
        const url = `https://api.github.com/repos/${owner}/${repo}/contents/index.html?ref=${branch}`;
        const res = await fetch(url, { headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' }, signal: controller.signal });
        if (!res.ok) { const errText = await res.json(); throw new Error(`Read: ${errText.message}`); }
        const data = await res.json();
        if(!data.content) throw new Error("File not found.");
        let currentContent = atob(data.content);
        
        // --- TOKEN LIMIT FIX START ---
        // Llama 3.1 70B has ~128k context. If file is huge, we must truncate.
        // We allow ~90k characters for input (conservative estimate) + 8k for output.
        const MAX_INPUT_CHARS = 90000;
        let contentToSend = currentContent;
        let isTruncated = false;

        if (currentContent.length > MAX_INPUT_CHARS) {
            isTruncated = true;
            const keepStart = 45000; 
            const keepEnd = 40000;
            const middlePlaceholder = "\n\n/* [SYSTEM: MIDDLE SECTION OMITTED TO SAVE TOKENS. PRESERVE EXISTING LOGIC HERE] */\n\n";
            
            contentToSend = currentContent.substring(0, keepStart) + 
                           middlePlaceholder + 
                           currentContent.substring(currentContent.length - keepEnd);
            
            addSystemMessage("⚠️ Context Window Full. Optimizing prompt...");
        }
        // --- TOKEN LIMIT FIX END ---

        addSystemMessage("🧬 MUTATING...");
        
        const systemInstruction = isTruncated 
            ? "You are an expert coder. The provided HTML file has been truncated in the middle. Apply the requested changes. For the truncated middle section, output ONLY the placeholder comment: /* [SYSTEM: MIDDLE SECTION OMITTED...] */. Do NOT hallucinate the middle content."
            : "You are an expert coder. Return the FULL modified HTML code.";

        const aiReq = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                model: API_MODEL,
                messages: [{ role: "system", content: systemInstruction + " Return ONLY raw code. No markdown." }, { role: "user", content: `Modify to: "${input}".\n\nCODE:\n` + contentToSend }],
                temperature: 0.2, 
                max_tokens: 8192 
            })
        });
        const aiData = await aiReq.json();
        
        if (aiData.error) {
            // Specific check for context length errors
            if(aiData.error.message.includes("context_length_exceeded") || aiData.error.type === "invalid_request_error") {
                throw new Error("Token limit exceeded. File is too complex for one-shot edit. Try smaller changes.");
            }
            throw new Error(`AI Error: ${aiData.error.message}`);
        }
        
        let newCode = aiData.choices[0].message.content;
        if (newCode.startsWith("```html")) newCode = newCode.substring(7);
        else if (newCode.startsWith("```")) newCode = newCode.substring(3);
        if (newCode.endsWith("```")) newCode = newCode.substring(0, newCode.length - 3);
        newCode = newCode.trim();

        // If we truncated, we need to stitch back the middle part
        if (isTruncated) {
            const placeholder = "/* [SYSTEM: MIDDLE SECTION OMITTED TO SAVE TOKENS. PRESERVE EXISTING LOGIC HERE] */";
            if (newCode.includes(placeholder)) {
                // Restore the middle section from the original file
                const middleStart = 45000;
                const middleEnd = currentContent.length - 40000;
                const originalMiddle = currentContent.substring(middleStart, middleEnd);
                newCode = newCode.replace(placeholder, originalMiddle);
                addSystemMessage("🧬 Stitching code...");
            } else {
                throw new Error("AI lost the placeholder context. Aborting to prevent corruption.");
            }
        }
        
        addSystemMessage("🧬 UPLOADING...");
        const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/index.html`;
        const encodedContent = btoa(unescape(encodeURIComponent(newCode)));
        const putRes = await fetch(putUrl, {
            method: 'PUT',
            headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: "Evolution: " + input,
                content: encodedContent,
                sha: data.sha,
                branch: branch
            }),
            signal: controller.signal
        });
        if (!putRes.ok) throw new Error(`GitHub Write Failed: ${putRes.statusText}`);
        clearTimeout(timeoutId);
        addSystemMessage("🎉 SUCCESS. REBOOTING...");
        setTimeout(() => location.reload(), 2000);
    } catch (err) {
        clearTimeout(timeoutId);
        if(err.name === 'AbortError') addSystemMessage("❌ Timeout.");
        else addSystemMessage("❌ FAIL: " + err.message);
    }
}
