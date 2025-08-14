// Firebase initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, doc, getDoc, setDoc, onSnapshot, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyApMIePEGH1tDmUuk16Ek3WHFW5ZvzhQ54",
  authDomain: "aiv-site.firebaseapp.com",
  projectId: "aiv-site",
  storageBucket: "aiv-site.firebasestorage.app",
  messagingSenderId: "50124905975",
  appId: "1:50124905975:web:cd4fa7210e070fa87c62f2" // Đây là appID của bạn
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        await initializeAuth();
    } else {
        // User is signed in, now we can load calendar data
        renderCalendar(currentYear);
    }
});

async function initializeAuth() {
     try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
        } else {
            await signInAnonymously(auth);
        }
     } catch (error) {
        console.error("Authentication failed:", error);
     }
}

// --- UI & TTS LOGIC ---
let currentLang = 'vi';
let voices = [];

function populateVoiceList() {
    if(typeof speechSynthesis === 'undefined') return;
    voices = speechSynthesis.getVoices();
}
populateVoiceList();
if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = populateVoiceList;
}

window.toggleSpeech = function(tabId) {
    const button = document.querySelector(`.speaker-button[data-tab-id="${tabId}"]`);
    if (!button) return;
    const speakerIcon = button.querySelector('.speaker-icon');
    const stopIcon = button.querySelector('.stop-icon');
    
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
        return;
    }

    const contentEl = document.getElementById(tabId);
    if (!contentEl) return;

    resetAllSpeakerIcons();

    let textToSpeak = '';
    // Get text only, exclude SVG content for cleaner speech
    const elementsToRead = contentEl.querySelectorAll('h1, h2, h3, h4, p, li, th, td, label, strong, span');
    elementsToRead.forEach(el => {
        if (!el.closest('.speaker-button')) {
            // Clone the node and remove SVG to get only text
            const clone = el.cloneNode(true);
            clone.querySelectorAll('svg').forEach(svg => svg.remove());
            textToSpeak += clone.innerText + '. ';
        }
    });

    if (textToSpeak.trim() === '') return;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    const targetLang = currentLang === 'vi' ? 'vi-VN' : 'ja-JP';
    const voice = voices.find(v => v.lang === targetLang) || voices.find(v => v.lang.startsWith(currentLang));
    if (voice) utterance.voice = voice;
    utterance.lang = targetLang;

    utterance.onend = function() {
        speakerIcon.classList.remove('hidden');
        stopIcon.classList.add('hidden');
        button.classList.remove('speaking');
    };

    speechSynthesis.speak(utterance);
    
    speakerIcon.classList.add('hidden');
    stopIcon.classList.remove('hidden');
    button.classList.add('speaking');
}

function resetAllSpeakerIcons() {
    document.querySelectorAll('.speaker-button').forEach(btn => {
        btn.classList.remove('speaking');
        btn.querySelector('.speaker-icon').classList.remove('hidden');
        btn.querySelector('.stop-icon').classList.add('hidden');
    });
}

window.switchTab = function(tabName) {
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
        resetAllSpeakerIcons();
    }

    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(`tab-content-${tabName}`).classList.add('active');
    document.getElementById(`tab-btn-${tabName}`).classList.add('active');
}

window.switchLanguage = function(lang) {
    currentLang = lang;
    document.querySelectorAll('[data-lang-vi]').forEach(el => {
        const text = el.getAttribute(`data-lang-${lang}`);
        if (text) {
            el.innerHTML = text;
        }
    });

    document.getElementById('lang-vi').classList.toggle('active', lang === 'vi');
    document.getElementById('lang-jp').classList.toggle('active', lang === 'jp');
    
    renderCalendar(currentYear); // Re-render calendar for language change

    const aiInput = document.getElementById('ai-input');
    if(aiInput) {
        aiInput.placeholder = lang === 'vi' ? "Nhập tình huống..." : "状況を入力...";
    }
}

// --- AI TOOL FUNCTIONS ---
async function callGeminiAPI(prompt, resultBox, buttonSelector) {
    const loadingText = currentLang === 'vi' ? 'AI đang xử lý...' : 'AIが処理中です...';
    const errorText = currentLang === 'vi' ? 'Đã có lỗi xảy ra.' : 'エラーが発生しました。';

    resultBox.innerHTML = `<div class="flex justify-center items-center h-full"><div class="loader"></div><p class="ml-3 text-slate-500">${loadingText}</p></div>`;
    document.querySelectorAll(buttonSelector).forEach(btn => btn.disabled = true);

    const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
    const apiKey = ""; 
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error(`API request failed`);
        const jsonResponse = await response.json();
        if (jsonResponse?.candidates?.[0]?.content?.parts?.[0]?.text) {
           resultBox.innerHTML = jsonResponse.candidates[0].content.parts[0].text.replace(/\n/g, '<br>');
        } else {
           throw new Error("Invalid response from API.");
        }
    } catch (error) {
        console.error(`Gemini API Error:`, error.message);
        resultBox.innerHTML = `<p class="text-red-500 text-center">${errorText}</p>`;
    } finally {
        document.querySelectorAll(buttonSelector).forEach(btn => btn.disabled = false);
    }
}

window.runAITool = async function(tool) {
    const input = document.getElementById('ai-input').value.trim();
    if (!input) {
        alert(currentLang === 'vi' ? 'Vui lòng nhập nội dung.' : '内容を入力してください。');
        return;
    }
    
    let prompt = '';
    const userInputText = `Nội dung từ người dùng: "${input}"`;

    switch(tool) {
        case 'draft': prompt = `Soạn thảo một thông điệp (email/tin nhắn) theo nguyên tắc Hou-Ren-Sou. ${userInputText}`; break;
        case 'analyze': prompt = `Phân tích nội dung sau dưới góc độ Hou-Ren-Sou, chỉ ra điểm tốt và cần cải thiện. ${userInputText}`; break;
        case 'soudan': prompt = `Giúp người dùng 'Soudan' (Bàn bạc) vấn đề sau: 1. Tóm tắt vấn đề. 2. Đưa ra 2-3 phương án. 3. Gợi ý cách bắt đầu cuộc trò chuyện. ${userInputText}`; break;
        case 'summarize': prompt = `Tóm tắt nội dung sau thành các gạch đầu dòng ngắn gọn. ${userInputText}`; break;
        case 'scenario': prompt = `Tạo kịch bản hội thoại ngắn (role-play) giữa nhân viên và quản lý để thực hành Hou-Ren-Sou. ${userInputText}`; break;
    }
    
    await callGeminiAPI(prompt, document.getElementById('ai-result-box'), '#ai-tools button');
}

window.clearAIResult = function() {
    const resultBox = document.getElementById('ai-result-box');
    const inputBox = document.getElementById('ai-input');
    const placeholderTextVI = "Kết quả từ AI sẽ xuất hiện ở đây.";
    const placeholderTextJP = "AIからの結果はここに表示されます。";
    resultBox.innerHTML = `<p class="text-slate-500 text-center" data-lang-vi="${placeholderTextVI}" data-lang-jp="${placeholderTextJP}">${currentLang === 'vi' ? placeholderTextVI : placeholderTextJP}</p>`;
    inputBox.value = '';
}

// --- QUIZ LOGIC ---
let currentQuizSetIndex = 0;
let currentPlayerName = '';

const allQuizData = [{
    name: 'Đề tổng hợp kiến thức giao tiếp',
    questions: [
        // Hou-Ren-Sou Questions (5)
        { question: "Chữ 'Ren' (連) trong Hou-Ren-Sou (報連相) có ý nghĩa cốt lõi là gì?", options: ["Liên lạc: Chủ động chia sẻ thông tin, dữ kiện", "Báo cáo: Trình bày kết quả công việc", "Bàn bạc: Xin ý kiến khi gặp khó khăn", "Lắng nghe: Tiếp thu chỉ thị từ cấp trên"], answer: "Liên lạc: Chủ động chia sẻ thông tin, dữ kiện" },
        { question: "Khi nào một nhân viên nên thực hiện 'Soudan' (相談)?", options: ["Khi đã hoàn thành xuất sắc công việc", "Khi gặp vướng mắc hoặc có nhiều phương án lựa chọn", "Khi muốn thông báo một sự thật đơn thuần như lịch họp", "Ngay sau khi nhận được chỉ thị mới"], answer: "Khi gặp vướng mắc hoặc có nhiều phương án lựa chọn" },
        { question: "Hành động nào sau đây là một ví dụ điển hình của 'Hokoku' (報告)?", options: ["Gửi email cho cả nhóm thông báo dời lịch họp", "Hỏi ý kiến đồng nghiệp về cách giải quyết một vấn đề khó", "Gửi báo cáo tiến độ dự án cuối ngày cho quản lý", "Xác nhận lại yêu cầu công việc với cấp trên"], answer: "Gửi báo cáo tiến độ dự án cuối ngày cho quản lý" },
        { question: "Mục đích chính của việc áp dụng Hou-Ren-Sou trong một tổ chức là gì?", options: ["Để nhân viên có thể tự do sáng tạo", "Để đảm bảo thông tin được lưu chuyển thông suốt từ dưới lên, giúp quản lý nắm tình hình", "Để giảm số lượng các cuộc họp không cần thiết", "Để tạo ra một môi trường làm việc ít quy tắc hơn"], answer: "Để đảm bảo thông tin được lưu chuyển thông suốt từ dưới lên, giúp quản lý nắm tình hình" },
        { question: "Thiếu sót trong 'Renraku' (連絡) có thể dẫn đến hậu quả trực tiếp nào?", options: ["Quản lý không hài lòng về kết quả công việc", "Đồng nghiệp không nắm được thông tin thay đổi, dẫn đến phối hợp sai lệch", "Nhân viên cảm thấy không được tôn trọng", "Dự án không có định hướng rõ ràng"], answer: "Đồng nghiệp không nắm được thông tin thay đổi, dẫn đến phối hợp sai lệch" },
        
        // O-Hi-Ta-Shi Questions (5)
        { question: "Nguyên tắc O-Hi-Ta-Shi (おひたし) là trách nhiệm của đối tượng nào trong giao tiếp công sở?", options: ["Toàn thể nhân viên", "Cấp quản lý và Leader", "Nhân viên mới", "Bộ phận nhân sự"], answer: "Cấp quản lý và Leader" },
        { question: "Khi nhân viên báo cáo một sai sót, hành động 'Okoranai' (怒らない) của người quản lý là gì?", options: ["Lập tức tìm cách giải quyết vấn đề", "Yêu cầu nhân viên giải trình chi tiết", "Giữ bình tĩnh, không tức giận hay chỉ trích cá nhân", "Phớt lờ vấn đề để tránh căng thẳng"], answer: "Giữ bình tĩnh, không tức giận hay chỉ trích cá nhân" },
        { question: "Một quản lý nói: 'Ý tưởng của em có vẻ không khả thi' ngay khi nhân viên vừa trình bày. Hành động này đi ngược lại với chữ nào trong O-Hi-Ta-Shi?", options: ["O (Okoranai - Không tức giận)", "Hi (Hitei shinai - Không phủ nhận)", "Ta (Tasukeru - Giúp đỡ)", "Shi (Shiji suru - Chỉ thị)"], answer: "Hi (Hitei shinai - Không phủ nhận)" },
        { question: "Hành động nào thể hiện rõ nhất tinh thần 'Tasukeru' (助ける) của người quản lý?", options: ["'Việc này em tự giải quyết đi.'", "'Tại sao lại để xảy ra sai sót này?'", "'Em có cần anh hỗ trợ thêm nguồn lực hay thông tin gì không?'", "'Hãy báo cáo lại cho anh khi có kết quả.'"], answer: "'Em có cần anh hỗ trợ thêm nguồn lực hay thông tin gì không?'" },
        { question: "Tại sao O-Hi-Ta-Shi được coi là 'chất xúc tác' cho Hou-Ren-Sou?", options: ["Vì nó thay thế hoàn toàn cho Hou-Ren-Sou", "Vì nó tạo ra một môi trường an toàn để nhân viên dám báo cáo và xin ý kiến", "Vì nó giúp báo cáo được thực hiện nhanh hơn", "Vì nó là quy trình bắt buộc của công ty"], answer: "Vì nó tạo ra một môi trường an toàn để nhân viên dám báo cáo và xin ý kiến" },

        // Kaku-Ren-Bou & Comparison Questions (5)
        { question: "Yếu tố 'Kaku' (確認) trong Kaku-Ren-Bou nhấn mạnh điều gì nhất?", options: ["Tốc độ báo cáo phải nhanh", "Sự chủ động xác nhận thông tin từ cả hai phía để tránh hiểu lầm", "Chỉ cần cấp trên xác nhận lại thông tin", "Việc báo cáo phải có bằng chứng rõ ràng"], answer: "Sự chủ động xác nhận thông tin từ cả hai phía để tránh hiểu lầm" },
        { question: "So với Hou-Ren-Sou, Kaku-Ren-Bou tập trung hơn vào việc gì?", options: ["Tạo môi trường làm việc thoải mái", "Đảm bảo dòng chảy thông tin từ dưới lên", "Chống nhiễu thông tin và đảm bảo sự chính xác tuyệt đối", "Khuyến khích nhân viên tự quyết định"], answer: "Chống nhiễu thông tin và đảm bảo sự chính xác tuyệt đối" },
        { question: "Trong mô hình giao tiếp toàn diện, nguyên tắc nào được ví như 'hệ thần kinh' đảm bảo mệnh lệnh được truyền đi chính xác?", options: ["Hou-Ren-Sou", "O-Hi-Ta-Shi", "Kaku-Ren-Bou", "Cả ba đều như nhau"], answer: "Kaku-Ren-Bou" },
        { question: "Hành động nào sau đây là một ví dụ của Kaku-Ren-Bou?", options: ["Nhân viên gửi email báo cáo công việc đã hoàn thành.", "Quản lý thông báo lịch họp mới cho cả nhóm.", "Nhân viên gửi lại email: 'Em xin xác nhận lại deadline cho công việc X là 5 giờ chiều nay, đúng không ạ?'", "Nhân viên hỏi ý kiến đồng nghiệp về một vấn đề."], answer: "Nhân viên gửi lại email: 'Em xin xác nhận lại deadline cho công việc X là 5 giờ chiều nay, đúng không ạ?'" },
        { question: "Việc thiết lập chương trình 'Open-door meetings' (họp cửa mở) nhằm mục đích chính là để thúc đẩy kỹ năng nào?", options: ["Hokoku (Báo cáo) một cách hiệu quả hơn", "Renraku (Liên lạc) nhanh chóng hơn", "Soudan (Bàn bạc) một cách cởi mở và không e ngại", "Kakunin (Xác nhận) thông tin chính xác hơn"], answer: "Soudan (Bàn bạc) một cách cởi mở và không e ngại" }
    ]
}]

function populateQuizSets() {
    const select = document.getElementById('quiz-set-select');
    select.innerHTML = '';
    allQuizData.forEach((set, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = set.name;
        select.appendChild(option);
    });
}

function switchQuizView(viewId) {
    document.querySelectorAll('.quiz-view').forEach(view => view.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

function loadQuiz(setIndex) {
    const quizContainer = document.getElementById('quiz-container');
    const quizTitle = document.getElementById('quiz-title');
    quizContainer.innerHTML = '';
    const quizData = allQuizData[setIndex].questions;
    quizTitle.textContent = allQuizData[setIndex].name;

    quizData.forEach((item, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'quiz-question';
        
        let optionsHtml = item.options.map((option, i) => `
            <div>
                <input type="radio" name="question${index}" id="q${index}o${i}" value="${option}" class="hidden">
                <label for="q${index}o${i}">${option}</label>
            </div>
        `).join('');

        questionDiv.innerHTML = `
            <p class="font-semibold text-lg mb-4">${index + 1}. ${item.question}</p>
            <div class="quiz-options space-y-2">${optionsHtml}</div>
        `;
        quizContainer.appendChild(questionDiv);
    });
}

async function submitQuiz() {
    const quizData = allQuizData[currentQuizSetIndex].questions;
    let score = 0;
    quizData.forEach((item, index) => {
        const selectedOption = document.querySelector(`input[name="question${index}"]:checked`);
        if (selectedOption && selectedOption.value === item.answer) {
            score++;
        }
    });
    
    document.getElementById('result-player-name').textContent = currentPlayerName;
    document.getElementById('quiz-score').textContent = `${score} / ${quizData.length}`;
    
    const feedbackEl = document.getElementById('quiz-feedback');
    if (score === quizData.length) feedbackEl.textContent = "Xuất sắc! Bạn đã trả lời đúng tất cả các câu hỏi.";
    else if (score >= quizData.length / 2) feedbackEl.textContent = "Làm tốt lắm! Hãy tiếp tục phát huy.";
    else feedbackEl.textContent = "Cố gắng hơn ở lần sau nhé!";

    await saveResultToFirestore(currentPlayerName, score, quizData.length, allQuizData[currentQuizSetIndex].name);
    switchQuizView('quiz-results-view');
}

async function saveResultToFirestore(name, score, total, setName) {
    try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const leaderboardCollection = collection(db, 'artifacts', appId, 'public', 'data', 'quizLeaderboard');
        await addDoc(leaderboardCollection, {
            name: name,
            score: score,
            totalQuestions: total,
            quizSet: setName,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Error saving result: ", error);
    }
}

function loadLeaderboard() {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const leaderboardCollection = collection(db, 'artifacts', appId, 'public', 'data', 'quizLeaderboard');
    // FIX: Remove the second orderBy clause to prevent index error.
    // The sorting will be done client-side.
    const q = query(leaderboardCollection);

    onSnapshot(q, (querySnapshot) => {
        const leaderboardBody = document.getElementById('leaderboard-body');
        leaderboardBody.innerHTML = '';
        if (querySnapshot.empty) {
            leaderboardBody.innerHTML = `<tr><td colspan="4" class="text-center text-slate-500 py-4">Chưa có ai làm bài.</td></tr>`;
            return;
        }
        
        // Fetch all documents and convert to an array for client-side sorting
        const results = [];
        querySnapshot.forEach((doc) => {
            results.push(doc.data());
        });

        // Sort the results in JavaScript
        results.sort((a, b) => {
            // Sort by score descending
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            // If scores are equal, sort by timestamp descending (newest first)
            // Ensure timestamp exists before comparing
            if (a.timestamp && b.timestamp) {
                 return b.timestamp.seconds - a.timestamp.seconds;
            }
            return 0;
        });

        // Take the top 20 results
        const topResults = results.slice(0, 20);

        let rank = 1;
        topResults.forEach((data) => {
            const row = `
                <tr>
                    <td class="text-center">${rank++}</td>
                    <td>${data.name}</td>
                    <td class="text-center">${data.score}/${data.totalQuestions}</td>
                    <td>${data.quizSet}</td>
                </tr>
            `;
            leaderboardBody.innerHTML += row;
        });
    });
}

// --- FEEDBACK LOGIC ---
window.submitFeedback = async function() {
    const feedbackInput = document.getElementById('feedback-input');
    const feedbackText = feedbackInput.value.trim();
    if (feedbackText === '') return;

    const submitButton = document.querySelector('#tab-content-feedback button');
    submitButton.disabled = true;

    try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const feedbackCollection = collection(db, 'artifacts', appId, 'public', 'data', 'feedback');
        await addDoc(feedbackCollection, { text: feedbackText, timestamp: serverTimestamp() });

        document.getElementById('feedback-thanks').classList.remove('hidden');
        feedbackInput.value = '';
        setTimeout(() => document.getElementById('feedback-thanks').classList.add('hidden'), 3000);
    } catch (error) {
        console.error("Error adding document: ", error);
    } finally {
        submitButton.disabled = false;
    }
}

// --- CALENDAR LOGIC ---
let currentYear = new Date().getFullYear();
let notes = {};
const modal = document.getElementById('note-modal');
let selectedDate = { year: 0, month: 0, day: 0 };

const monthNames = {
    vi: ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"],
    jp: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]
};
const dayNames = {
    vi: ["CN", "T2", "T3", "T4", "T5", "T6", "T7"],
    jp: ["日", "月", "火", "水", "木", "金", "土"]
};

async function loadNotesForYear(year) {
    if (!auth.currentUser) {
        console.log("User not authenticated, cannot load notes.");
        return {};
    }
    try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'calendarNotes', String(year));
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        }
        return {};
    } catch (error) {
        console.error("Error loading notes:", error);
        return {};
    }
}

function renderNoteSummary(year) {
    const tbody = document.getElementById('note-summary-body');
    tbody.innerHTML = '';

    const sortedNotes = Object.keys(notes)
        .map(key => ({ key, text: notes[key] }))
        .sort((a, b) => {
            const [monthA, dayA] = a.key.split('-').map(Number);
            const [monthB, dayB] = b.key.split('-').map(Number);
            if (monthA !== monthB) return monthA - monthB;
            return dayA - dayB;
        });

    if (sortedNotes.length === 0) {
        const noNotesText = currentLang === 'vi' ? 'Không có ghi chú nào trong năm nay.' : 'この年にはノートがありません。';
        tbody.innerHTML = `<tr><td colspan="3" class="text-center text-slate-500 py-4">${noNotesText}</td></tr>`;
        return;
    }

    sortedNotes.forEach((note, index) => {
        const [month, day] = note.key.split('-').map(Number);
        const dateStr = `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;
        const row = `
            <tr>
                <td class="text-center">${index + 1}</td>
                <td>${dateStr}</td>
                <td>${note.text}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

window.renderCalendar = async function(year) {
    document.getElementById('current-year').textContent = year;
    const container = document.getElementById('calendar-container');
    if (!container) return;
    container.innerHTML = '<div class="col-span-full flex justify-center"><div class="loader"></div></div>';
    
    notes = await loadNotesForYear(year);
    container.innerHTML = '';

    const today = new Date();
    const isCurrentYear = today.getFullYear() === year;

    for (let month = 0; month < 12; month++) {
        const monthCard = document.createElement('div');
        monthCard.className = 'month-card';

        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        let daysHtml = `<div class="month-header">${monthNames[currentLang][month]}</div>`;
        daysHtml += '<div class="days-grid">';
        
        dayNames[currentLang].forEach(name => {
            daysHtml += `<div class="day-name">${name}</div>`;
        });

        for (let i = 0; i < firstDayOfMonth; i++) {
            daysHtml += '<div class="day-cell empty"></div>';
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = `${month}-${day}`;
            const dayOfWeek = new Date(year, month, day).getDay();
            const isToday = isCurrentYear && today.getMonth() === month && today.getDate() === day;
            
            let classes = 'day-cell';
            if (isToday) {
                classes += ' today';
            } else if (dayOfWeek === 0 || dayOfWeek === 6) { // 0 is Sunday, 6 is Saturday
                classes += ' weekend';
            }

            if (notes[dateKey]) {
                classes += ' has-note';
            }

            daysHtml += `<div class="${classes}" onclick="openNoteModal(${year}, ${month}, ${day})">${day}</div>`;
        }

        daysHtml += '</div>';
        monthCard.innerHTML = daysHtml;
        container.appendChild(monthCard);
    }
    
    // Render the summary table after rendering the calendar
    renderNoteSummary(year);
}

window.changeYear = function(offset) {
    currentYear += offset;
    renderCalendar(currentYear);
}

window.jumpToYear = function() {
    const yearInput = document.getElementById('year-input');
    const year = parseInt(yearInput.value);
    if (year && year > 1900 && year < 3000) {
        currentYear = year;
        renderCalendar(currentYear);
    }
}

window.openNoteModal = function(year, month, day) {
    selectedDate = { year, month, day };
    const dateKey = `${month}-${day}`;
    document.getElementById('modal-title').textContent = `${day} ${monthNames[currentLang][month]}, ${year}`;
    document.getElementById('note-textarea').value = notes[dateKey] || '';
    modal.classList.add('show');
    document.getElementById('note-textarea').focus();
}

window.closeNoteModal = function() {
    modal.classList.remove('show');
}

window.saveNote = async function() {
    if (!auth.currentUser) {
        alert("Bạn cần đăng nhập để lưu ghi chú.");
        return;
    }
    const noteText = document.getElementById('note-textarea').value.trim();
    const { year, month, day } = selectedDate;
    const dateKey = `${month}-${day}`;

    if (noteText) {
        notes[dateKey] = noteText;
    } else {
        delete notes[dateKey];
    }

    try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'calendarNotes', String(year));
        await setDoc(docRef, notes, { merge: true });
        closeNoteModal();
        renderCalendar(year); // Re-render to show note indicator and update summary table
    } catch (error) {
        console.error("Error saving note:", error);
        alert("Lỗi khi lưu ghi chú.");
    }
}


// --- ONLOAD & SCROLL EFFECTS ---
window.onload = function() {
    initializeAuth().then(() => {
        // Initial render after auth is complete
        switchLanguage('vi');
        populateQuizSets();
        loadLeaderboard();
    });
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.content-section').forEach(section => {
        observer.observe(section);
    });

    const backToTopButton = document.getElementById('back-to-top');
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            backToTopButton.classList.add('show');
        } else {
            backToTopButton.classList.remove('show');
        }
    });

    backToTopButton.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    
    // Close modal on outside click
    modal.addEventListener('click', (e) => {
        if (e.target.id === 'note-modal') {
            closeNoteModal();
        }
    });
    
    // Quiz Event Listeners
    document.getElementById('start-quiz-btn').addEventListener('click', () => {
        currentPlayerName = document.getElementById('player-name').value.trim();
        if (!currentPlayerName) {
            alert('Vui lòng nhập tên của bạn để bắt đầu!');
            return;
        }
        currentQuizSetIndex = document.getElementById('quiz-set-select').value;
        loadQuiz(currentQuizSetIndex);
        switchQuizView('quiz-container-view');
    });

    document.getElementById('submit-quiz-btn').addEventListener('click', submitQuiz);
    document.getElementById('play-again-btn').addEventListener('click', () => {
        switchQuizView('quiz-setup');
    });

};
