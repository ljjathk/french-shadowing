let currentData = [];
let originalData = [];
let currentIndex = -1;
let isAutoPlaying = false;
let isShuffled = false;
let isShadowing = false;
let isRecognizing = false;
let isSimpleDict = false;
let isFullDict = false;
let currentLevel = 'beginner';
let mediaRecorder;
let audioChunks = [];

const vocabList = document.getElementById('vocabList');
const statsEl = document.getElementById('stats');
const autoPlayBtn = document.getElementById('autoPlayBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const shadowBtn = document.getElementById('shadowBtn');
const recognizeBtn = document.getElementById('recognizeBtn');
const simpleBtn = document.getElementById('simpleBtn');
const fullBtn = document.getElementById('fullBtn');
const alphabetNav = document.getElementById('alphabetNav');
const audioPlayer = document.getElementById('audioPlayer');
const tabBtns = document.querySelectorAll('.tab-btn');

async function loadData(level) {
    vocabList.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>⏳ 加载 ${level === 'beginner' ? '初级' : 'u4e2du7ea7'} 词汇...</p>
        </div>
    `;
    
    try {
        const response = await fetch(`data/${level}.json`);
        originalData = await response.json();
        currentData = [...originalData];
        renderAlphabetNav(originalData);
        renderList(currentData);
        updateStats();
    } catch (error) {
        vocabList.innerHTML = `<p style="color: #ef4444; text-align: center;">加载失败: ${error.message}</p>`;
    }
}

function renderAlphabetNav(data) {
    const counts = {};
    data.forEach(item => {
        let firstLetter = item.word.charAt(0).toUpperCase();
        firstLetter = firstLetter.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (!/^[A-Z]$/.test(firstLetter)) firstLetter = "#";
        counts[firstLetter] = (counts[firstLetter] || 0) + 1;
    });

    const sortedLetters = Object.keys(counts).sort();
    alphabetNav.innerHTML = '';
    
    sortedLetters.forEach(letter => {
        const btn = document.createElement('button');
        btn.className = 'alpha-btn';
        btn.innerHTML = `${letter} <span>(${counts[letter]})</span>`;
        btn.onclick = () => jumpToLetter(letter);
        alphabetNav.appendChild(btn);
    });
}

function jumpToLetter(letter) {
    const header = document.getElementById(`letter-${letter}`);
    if (header) {
        const offset = 160; 
        const bodyRect = document.body.getBoundingClientRect().top;
        const elementRect = header.getBoundingClientRect().top;
        const elementPosition = elementRect - bodyRect;
        const offsetPosition = elementPosition - offset;

        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });

        document.querySelectorAll('.alpha-btn').forEach(b => {
            b.classList.toggle('active', b.textContent.startsWith(letter));
        });
    }
}

function renderList(data) {
    vocabList.innerHTML = '';
    let currentLetter = '';

    data.forEach((item, index) => {
        if (!isShuffled) {
            let firstLetter = item.word.charAt(0).toUpperCase();
            firstLetter = firstLetter.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (!/^[A-Z]$/.test(firstLetter)) firstLetter = "#";

            if (firstLetter !== currentLetter) {
                currentLetter = firstLetter;
                const header = document.createElement('div');
                header.className = 'letter-header';
                header.id = `letter-${currentLetter}`;
                header.textContent = currentLetter;
                vocabList.appendChild(header);
            }
        }

        const card = document.createElement('div');
        card.className = 'word-card';
        card.id = `card-${index}`;
        
        let wordDisplay = `<span class="french-word ${isRecognizing ? 'blurred' : ''}">${item.word}</span>`;
        
        if (isSimpleDict || isFullDict) {
            wordDisplay = createDictationHTML(item.word, index);
        }

        card.innerHTML = `
            <div class="word-info">
                <div class="word-header">
                    ${wordDisplay}
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
    
    const prevCard = document.querySelector('.word-card.playing');
    if (prevCard) prevCard.classList.remove('playing');
    
    const card = document.getElementById(`card-${index}`);
    if (card) {
        card.classList.add('playing');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Recognition Mode: Blur word and reveal after 3s
        if (isRecognizing) {
            const frenchWord = card.querySelector('.french-word');
            if (frenchWord) {
                frenchWord.classList.add('blurred');
                setTimeout(() => {
                    frenchWord.classList.remove('blurred');
                }, 3000);
            }
        }
    }
    
    currentIndex = index;
    const item = currentData[index];
    audioPlayer.src = item.audio;
    audioPlayer.onerror = () => {
        console.warn(`Audio not ready for: ${item.word}`);
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
            const duration = audioPlayer.duration || 1;
            waitTime = Math.max(2000, duration * 2000); 
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

// Fisher-Yates Shuffle
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

shuffleBtn.onclick = () => {
    isShuffled = !isShuffled;
    shuffleBtn.classList.toggle('active', isShuffled);
    
    if (isShuffled) {
        shuffleArray(currentData);
        alphabetNav.style.display = 'none';
        renderList(currentData);
        currentIndex = 0;
        isAutoPlaying = true;
        autoPlayBtn.classList.add('active');
        playWord(0);
    } else {
        currentData = [...originalData];
        alphabetNav.style.display = 'flex';
        renderList(currentData);
        currentIndex = -1;
        stopAutoPlay();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
};


const toggleModesBtn = document.getElementById('toggleModesBtn');
const modesPanel = document.getElementById('modesPanel');

toggleModesBtn.onclick = () => {
    modesPanel.classList.toggle('hidden');
    toggleModesBtn.classList.toggle('active');
};

shadowBtn.onclick = () => {
    isShadowing = !isShadowing;
    shadowBtn.classList.toggle('active', isShadowing);
    shadowBtn.innerHTML = `<span>🎤</span> 跟读模式: ${isShadowing ? '开' : '关'}`;
};

recognizeBtn.onclick = () => {
    isRecognizing = !isRecognizing;
    recognizeBtn.classList.toggle('active', isRecognizing);
    recognizeBtn.innerHTML = `<span>👁️‍🗨️</span> 辨音模式: ${isRecognizing ? '开' : '关'}`;
    if (isRecognizing) { isSimpleDict = false; isFullDict = false; updateDictButtons(); }
    renderList(currentData);
};

simpleBtn.onclick = () => {
    isSimpleDict = !isSimpleDict;
    if (isSimpleDict) { isFullDict = false; isRecognizing = false; updateRecognizeButton(); }
    updateDictButtons();
    renderList(currentData);
};

fullBtn.onclick = () => {
    isFullDict = !isFullDict;
    if (isFullDict) { isSimpleDict = false; isRecognizing = false; updateRecognizeButton(); }
    updateDictButtons();
    renderList(currentData);
};

function updateDictButtons() {
    simpleBtn.classList.toggle('active', isSimpleDict);
    simpleBtn.innerHTML = `<span>📝</span> 简易听写: ${isSimpleDict ? '开' : '关'}`;
    fullBtn.classList.toggle('active', isFullDict);
    fullBtn.innerHTML = `<span>⌨️</span> 全部听写: ${isFullDict ? '开' : '关'}`;
}

function updateRecognizeButton() {
    recognizeBtn.classList.remove('active');
    recognizeBtn.innerHTML = `<span>👁️‍🗨️</span> 辨音模式: 关`;
}

function createDictationHTML(word, wordIndex) {
    if (isFullDict) {
        return `
            <div class="dict-container">
                <input type="text" class="dict-input full-dict-input" 
                    placeholder="输入完整单词..."
                    oninput="checkFullDict(this, '${word.replace(/'/g, "\\'")}', ${wordIndex})"
                    onclick="event.stopPropagation()">
            </div>
        `;
    }
    
    // Simple Dictation: 1-2 random letters hidden
    let chars = word.split('');
    let indices = [];
    chars.forEach((c, i) => {
        if (/[a-zA-Z\u00C0-\u017F]/.test(c)) indices.push(i);
    });
    
    // Pick 1-2 random indices
    let numBlanks = Math.min(indices.length, Math.random() > 0.5 ? 2 : 1);
    let blanks = [];
    while (blanks.length < numBlanks) {
        let r = indices[Math.floor(Math.random() * indices.length)];
        if (!blanks.includes(r)) blanks.push(r);
    }
    
    let html = '<div class="dict-container">';
    chars.forEach((c, i) => {
        if (blanks.includes(i)) {
            html += `<input type="text" class="dict-input" style="width: 1.5rem;" maxlength="1"
                oninput="checkSimpleDict(this, '${c}', ${wordIndex})"
                onclick="event.stopPropagation()">`;
        } else {
            html += `<span>${c}</span>`;
        }
    });
    html += '</div>';
    return html;
}

window.checkSimpleDict = (input, correctChar, wordIndex) => {
    if (input.value.toLowerCase() === correctChar.toLowerCase()) {
        input.classList.add('correct');
        input.disabled = true;
    } else if (input.value.length > 0) {
        input.classList.add('wrong');
        setTimeout(() => input.classList.remove('wrong'), 500);
    }
};

window.checkFullDict = (input, correctWord, wordIndex) => {
    const cleanInput = input.value.trim().toLowerCase();
    const cleanWord = correctWord.trim().toLowerCase();
    if (cleanInput === cleanWord) {
        input.classList.add('correct');
        input.disabled = true;
    }
};

let recognition = null;

function showFeedback(card, message, isError = false) {
    let feedbackEl = card.querySelector('.speech-feedback');
    if (!feedbackEl) {
        feedbackEl = document.createElement('div');
        feedbackEl.className = 'speech-feedback';
        feedbackEl.style.marginTop = '8px';
        feedbackEl.style.fontSize = '0.9rem';
        feedbackEl.style.fontWeight = '600';
        card.querySelector('.word-info').appendChild(feedbackEl);
    }
    feedbackEl.innerHTML = message;
    feedbackEl.style.color = isError ? '#ef4444' : '#10b981';
}

async function fallbackToMediaRecorder(btn, card) {
    if (btn.classList.contains('active')) {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        btn.classList.remove('active');
        card.classList.remove('recording');
        return;
    }

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
            audio.play(); 
        };

        mediaRecorder.start();
        btn.classList.add('active');
        card.classList.add('recording');
        showFeedback(card, "⚠️ 浏览器不支持智能识别，已降级为普通录音跟读", true);
    } catch (err) {
        showFeedback(card, '❌ 无法访问麦克风: ' + err.message, true);
    }
}

function toggleRecord(event, index) {
    event.stopPropagation();
    const btn = event.currentTarget;
    const card = document.getElementById(`card-${index}`);
    const targetWord = currentData[index].word;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        fallbackToMediaRecorder(btn, card);
        return;
    }

    if (btn.classList.contains('active')) {
        if (recognition) recognition.stop();
        btn.classList.remove('active');
        card.classList.remove('recording');
        return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR'; 
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        btn.classList.add('active');
        card.classList.add('recording');
        
        // 移除之前的反馈
        const existingFeedback = card.querySelector('.speech-feedback');
        if (existingFeedback) existingFeedback.remove();
    };

    recognition.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        
        const cleanTarget = targetWord.toLowerCase().replace(/[.,!?;:()]/g, '').trim();
        const cleanTranscript = transcript.toLowerCase().replace(/[.,!?;:()]/g, '').trim();
        
        const isCorrect = cleanTranscript === cleanTarget || cleanTranscript.includes(cleanTarget) || cleanTarget.includes(cleanTranscript);
        
        if (isCorrect) {
            showFeedback(card, `✅ 识别到: <b>${transcript}</b> (发音很棒！)`, false);
        } else {
            showFeedback(card, `❌ 识别到: <b>${transcript}</b> (再试一次吧)`, true);
        }
    };

    recognition.onerror = (e) => {
        console.error('Speech recognition error', e.error);
        if (e.error === 'not-allowed') {
            showFeedback(card, '❌ 请允许麦克风权限', true);
        } else if (e.error === 'network') {
            showFeedback(card, '❌ 语音识别需要网络连接', true);
        } else {
            showFeedback(card, `❌ 识别出错: ${e.error}`, true);
        }
    };

    recognition.onend = () => {
        btn.classList.remove('active');
        card.classList.remove('recording');
    };

    try {
        recognition.start();
    } catch (err) {
        console.error(err);
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

loadData('beginner');
