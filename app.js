let currentData = [];
let currentIndex = -1;
let isAutoPlaying = false;
let isShuffled = false;
let isShadowing = false;
let currentLevel = 'beginner';
let mediaRecorder;
let audioChunks = [];

const vocabList = document.getElementById('vocabList');
const statsEl = document.getElementById('stats');
const autoPlayBtn = document.getElementById('autoPlayBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const shadowBtn = document.getElementById('shadowBtn');
const audioPlayer = document.getElementById('audioPlayer');
const tabBtns = document.querySelectorAll('.tab-btn');

async function loadData(level) {
    vocabList.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>⏳ 加载 ${level === 'beginner' ? '初级' : '中级'} 词汇...</p>
        </div>
    `;
    
    try {
        const response = await fetch(`data/${level}.json`);
        currentData = await response.json();
        renderList(currentData);
        updateStats();
    } catch (error) {
        vocabList.innerHTML = `<p style="color: #ef4444; text-align: center;">加载失败: ${error.message}</p>`;
    }
}

function renderList(data) {
    vocabList.innerHTML = '';
    data.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'word-card';
        card.id = `card-${index}`;
        card.innerHTML = `
            <div class="word-info">
                <div class="word-header">
                    <span class="french-word">${item.word}</span>
                    <span class="word-type">${item.type}</span>
                </div>
                <div class="meaning">${item.meaning}</div>
            </div>
            <div style="display: flex; align-items: center;">
                <button class="mic-btn" onclick="toggleRecord(event, ${index})" title="录音跟读">🎤</button>
                <div class="play-icon">▶</div>
            </div>
            <span class="page-num">P${item.page}</span>
        `;
        card.onclick = (e) => {
            if (e.target.closest('.mic-btn')) return;
            playWord(index);
        };
        vocabList.appendChild(card);
    });
}

function updateStats() {
    statsEl.textContent = `${currentLevel === 'beginner' ? '初级' : '中级'} · ${currentData.length} 词`;
}

function playWord(index) {
    if (index < 0 || index >= currentData.length) return;
    
    // UI Update
    const prevCard = document.querySelector('.word-card.playing');
    if (prevCard) prevCard.classList.remove('playing');
    
    const card = document.getElementById(`card-${index}`);
    if (card) {
        card.classList.add('playing');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    currentIndex = index;
    const item = currentData[index];
    audioPlayer.src = item.audio;
    audioPlayer.onerror = () => {
        console.warn(`Audio not ready for: ${item.word}`);
        // Optionally skip to next if autoplaying
        if (isAutoPlaying) {
             setTimeout(() => nextWord(), 500);
        }
    };
    audioPlayer.play();
}

function nextWord() {
    if (currentIndex + 1 < currentData.length) {
        playWord(currentIndex + 1);
    } else {
        stopAutoPlay();
    }
}

function stopAutoPlay() {
    isAutoPlaying = false;
    autoPlayBtn.classList.remove('active');
}

audioPlayer.onended = () => {
    if (isAutoPlaying) {
        let waitTime = 1000;
        if (isShadowing) {
            // Shadowing mode: wait longer for user to repeat
            const duration = audioPlayer.duration || 1;
            waitTime = Math.max(2000, duration * 2000); // 2x duration or min 2s
        }
        
        setTimeout(() => {
            if (isAutoPlaying) nextWord();
        }, waitTime);
    }
};

autoPlayBtn.onclick = () => {
    isAutoPlaying = !isAutoPlaying;
    autoPlayBtn.classList.toggle('active', isAutoPlaying);
    if (isAutoPlaying) {
        playWord(currentIndex === -1 ? 0 : currentIndex);
    }
};

shuffleBtn.onclick = () => {
    isShuffled = !isShuffled;
    shuffleBtn.classList.toggle('active', isShuffled);
    
    if (isShuffled) {
        currentData = [...currentData].sort(() => Math.random() - 0.5);
    } else {
        loadData(currentLevel);
        return;
    }
    renderList(currentData);
    currentIndex = -1;
};

shadowBtn.onclick = () => {
    isShadowing = !isShadowing;
    shadowBtn.classList.toggle('active', isShadowing);
    shadowBtn.innerHTML = `<span>🎤</span> 跟读模式: ${isShadowing ? '开' : '关'}`;
};

// Recording Logic
async function toggleRecord(event, index) {
    event.stopPropagation();
    const btn = event.currentTarget;
    const card = document.getElementById(`card-${index}`);

    if (btn.classList.contains('active')) {
        // Stop recording
        mediaRecorder.stop();
        btn.classList.remove('active');
        card.classList.remove('recording');
    } else {
        // Start recording
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (e) => {
                audioChunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);
                audio.play(); // Play back recording
            };

            mediaRecorder.start();
            btn.classList.add('active');
            card.classList.add('recording');
        } catch (err) {
            alert('无法启动录音: ' + err.message);
        }
    }
}

tabBtns.forEach(btn => {
    btn.onclick = () => {
        if (btn.classList.contains('active')) return;
        
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        currentLevel = btn.dataset.level;
        stopAutoPlay();
        currentIndex = -1;
        loadData(currentLevel);
    };
});

// Initial load
loadData('beginner');
