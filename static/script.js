// Use the current host for API requests
const OPENAI_API_URL = `${window.location.protocol}//${window.location.host}/v1/audio/speech`;
const processingStatus = document.getElementById('processing-status');
const activeRequests = document.getElementById('queue-size');
const lastUpdate = document.getElementById('last-update');
const maxQueueSize = document.getElementById('max-queue-size');
const queueProgressBar = document.getElementById('queue-progress-bar');
const statusIndicator = document.getElementById('status-indicator');
const queueLoadText = document.getElementById('queue-load-text');

// Track active requests
let currentActiveRequests = 0;

// Initialize current language
let currentLang = 'en';

// Language translations
const translations = {
    en: {
        title: "OpenAI TTS API Documentation",
        subtitle: "Text-to-Speech API with Multiple Voice Options",
        tryItOut: "Try It Out",
        textToConvert: "Text to Convert",
        voice: "Voice",
        instructions: "Instructions (Optional)",
        generateSpeech: "Generate Speech",
        quickStart: "Quick Start",
        availableVoices: "Available Voices",
        apiReference: "API Reference",
        queueStatus: "Queue Status",
        activeRequests: "Active Requests",
        maxCapacity: "Maximum Capacity",
        noLoad: "No Load",
        lowLoad: "Low Load",
        mediumLoad: "Medium Load",
        highLoad: "High Load"
    },
    zh: {
        title: "OpenAI TTS API 文档",
        subtitle: "支持多种语音的文本转语音 API",
        tryItOut: "立即体验",
        textToConvert: "要转换的文本",
        voice: "语音",
        instructions: "指令（可选）",
        generateSpeech: "生成语音",
        quickStart: "快速开始",
        availableVoices: "可用语音",
        apiReference: "API 参考",
        queueStatus: "队列状态",
        activeRequests: "活动请求",
        maxCapacity: "最大容量",
        noLoad: "无负载",
        lowLoad: "低负载",
        mediumLoad: "中负载",
        highLoad: "高负载"
    }
};

// Language switching functionality
document.addEventListener('DOMContentLoaded', function() {
    const langButtons = document.querySelectorAll('.lang-btn');
    
    // Set initial language based on current page
    const isChinesePage = window.location.pathname.includes('_zh.html');
    currentLang = isChinesePage ? 'zh' : 'en';
    
    // Update active state of language buttons
    langButtons.forEach(btn => {
        if (btn.getAttribute('data-lang') === currentLang) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Initial queue size update
    updateQueueSize();
});

function updateProcessingStatus(requestCount) {
    if (requestCount > 0) {
        processingStatus.textContent = 'Processing';
        processingStatus.className = 'processing';
    } else {
        processingStatus.textContent = 'Idle';
        processingStatus.className = 'idle';
    }
}

function updateLastUpdate() {
    const now = new Date();
    if (lastUpdate) {
        lastUpdate.textContent = now.toLocaleTimeString();
    }
}

// Function to update queue size with visual indicators
async function updateQueueSize() {
    try {
        const response = await fetch('/api/queue-size');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // Update text values
        document.getElementById('queue-size').textContent = data.queue_size;
        document.getElementById('max-queue-size').textContent = data.max_queue_size;
        
        // Calculate load percentage
        const loadPercentage = (data.queue_size / data.max_queue_size) * 100;
        
        // Update progress bar width
        queueProgressBar.style.width = `${Math.min(loadPercentage, 100)}%`;
        
        // Update status indicators based on load
        updateLoadStatus(loadPercentage);
        
    } catch (error) {
        console.error('Error fetching queue size:', error);
        // Show error state in UI
        document.getElementById('queue-size').textContent = '?';
        document.getElementById('max-queue-size').textContent = '?';
        queueProgressBar.style.width = '0%';
        statusIndicator.classList.remove('indicator-low', 'indicator-medium', 'indicator-high');
        queueProgressBar.classList.remove('progress-low', 'progress-medium', 'progress-high');
        queueLoadText.classList.remove('low-load', 'medium-load', 'high-load');
        queueLoadText.textContent = 'Error';
    }
}

// Function to update load status indicators
function updateLoadStatus(loadPercentage) {
    // Remove all existing classes
    statusIndicator.classList.remove('indicator-low', 'indicator-medium', 'indicator-high');
    queueProgressBar.classList.remove('progress-low', 'progress-medium', 'progress-high');
    queueLoadText.classList.remove('low-load', 'medium-load', 'high-load');
    
    // Apply appropriate classes based on load percentage
    if (loadPercentage >= 75) {
        // High load (75-100%)
        statusIndicator.classList.add('indicator-high');
        queueProgressBar.classList.add('progress-high');
        queueLoadText.classList.add('high-load');
        queueLoadText.textContent = translations[currentLang].highLoad;
    } else if (loadPercentage >= 40) {
        // Medium load (40-75%)
        statusIndicator.classList.add('indicator-medium');
        queueProgressBar.classList.add('progress-medium');
        queueLoadText.classList.add('medium-load');
        queueLoadText.textContent = translations[currentLang].mediumLoad;
    } else {
        // Low load (0-40%)
        statusIndicator.classList.add('indicator-low');
        queueProgressBar.classList.add('progress-low');
        queueLoadText.classList.add('low-load');
        queueLoadText.textContent = loadPercentage > 0 ? translations[currentLang].lowLoad : translations[currentLang].noLoad;
    }
}

// Update queue size every 2 seconds
setInterval(updateQueueSize, 2000);

// Initial update
updateQueueSize();

// Function to copy code blocks
function copyCode(button) {
    const codeBlock = button.closest('.code-block').querySelector('code');
    const text = codeBlock.textContent;
    
    navigator.clipboard.writeText(text).then(() => {
        // Visual feedback
        const originalIcon = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check"></i>';
        button.style.color = '#4CAF50';
        
        // Reset after 2 seconds
        setTimeout(() => {
            button.innerHTML = originalIcon;
            button.style.color = '';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text:', err);
        // Visual feedback for error
        button.style.color = '#f44336';
        setTimeout(() => {
            button.style.color = '';
        }, 2000);
    });
}

// Playground functionality
document.addEventListener('DOMContentLoaded', function() {
    const submitButton = document.getElementById('playground-submit');
    const textInput = document.getElementById('playground-text');
    const voiceSelect = document.getElementById('playground-voice');
    const instructionsInput = document.getElementById('playground-instructions');
    const statusDiv = document.getElementById('playground-status');
    const audioDiv = document.getElementById('playground-audio');

    submitButton.addEventListener('click', async function() {
        const text = textInput.value.trim();
        const voice = voiceSelect.value;
        const instructions = instructionsInput.value.trim();

        if (!text) {
            showStatus('Please enter some text to convert', 'error');
            return;
        }

        // Disable the submit button and show loading state
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        showStatus('Generating speech...', 'success');
        audioDiv.innerHTML = '';

        try {
            const response = await fetch(OPENAI_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    input: text,
                    voice: voice,
                    instructions: instructions || undefined
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to generate speech');
            }

            const blob = await response.blob();
            const audioUrl = URL.createObjectURL(blob);
            
            // Create audio element
            const audio = document.createElement('audio');
            audio.controls = true;
            audio.src = audioUrl;
            
            // Clear previous audio and add new one
            audioDiv.innerHTML = '';
            audioDiv.appendChild(audio);
            
            showStatus('Speech generated successfully!', 'success');
        } catch (error) {
            showStatus(error.message || 'Failed to generate speech', 'error');
        } finally {
            // Re-enable the submit button and restore original text
            submitButton.disabled = false;
            submitButton.innerHTML = '<i class="fas fa-play"></i> Generate Speech';
        }
    });

    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = `playground-status ${type}`;
    }
});

// 添加一个版本号，用于防止缓存问题
const VERSION = '1.2';

// 添加一个函数，用于给URL添加版本参数
function addVersionParam(url) {
    // 如果URL已经有参数，添加&v=VERSION；否则添加?v=VERSION
    return url.includes('?') ? `${url}&v=${VERSION}` : `${url}?v=${VERSION}`;
}

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
    // 检查是否需要强制刷新页面来清除缓存
    const lastVersion = localStorage.getItem('ttsfm_version');
    if (lastVersion !== VERSION) {
        // 存储新版本号
        localStorage.setItem('ttsfm_version', VERSION);
        // 如果版本不匹配且不是第一次加载（lastVersion不为null），则强制刷新
        if (lastVersion) {
            // 添加时间戳参数强制刷新所有资源
            window.location.href = addVersionParam(window.location.href);
            return;
        }
    }

    // 初始化队列状态
    updateQueueStatus();
    
    // 设置定时更新队列状态
    setInterval(updateQueueStatus, 5000);
    
    // 绑定表单提交事件
    const playgroundForm = document.getElementById('playground-submit');
    if (playgroundForm) {
        playgroundForm.addEventListener('click', handlePlaygroundSubmit);
    }
});

// 更新队列状态
async function updateQueueStatus() {
    try {
        // 加入时间戳以防止缓存
        const response = await fetch(addVersionParam('/api/queue-size'));
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // 更新DOM
        document.getElementById('queue-size').textContent = data.queue_size;
        document.getElementById('max-queue-size').textContent = data.max_queue_size;
        
        // 计算队列占用百分比
        const percentage = (data.queue_size / data.max_queue_size) * 100;
        document.getElementById('queue-progress-bar').style.width = `${percentage}%`;
        
        // 设置状态指示
        const statusIndicator = document.getElementById('status-indicator');
        const queueLoadText = document.getElementById('queue-load-text');
        const progressBar = document.getElementById('queue-progress-bar');
        
        // 根据队列大小更新状态
        if (percentage === 0) {
            statusIndicator.className = 'status-indicator indicator-low';
            progressBar.className = 'queue-progress-bar progress-low';
            queueLoadText.className = 'queue-load-text low-load';
            
            // 设置显示文本 - 根据当前语言
            if (document.documentElement.lang === 'zh') {
                queueLoadText.textContent = '无负载';
            } else {
                queueLoadText.textContent = 'No Load';
            }
        } else if (percentage < 50) {
            statusIndicator.className = 'status-indicator indicator-low';
            progressBar.className = 'queue-progress-bar progress-low';
            queueLoadText.className = 'queue-load-text low-load';
            
            if (document.documentElement.lang === 'zh') {
                queueLoadText.textContent = '低负载';
            } else {
                queueLoadText.textContent = 'Low Load';
            }
        } else if (percentage < 80) {
            statusIndicator.className = 'status-indicator indicator-medium';
            progressBar.className = 'queue-progress-bar progress-medium';
            queueLoadText.className = 'queue-load-text medium-load';
            
            if (document.documentElement.lang === 'zh') {
                queueLoadText.textContent = '中等负载';
            } else {
                queueLoadText.textContent = 'Medium Load';
            }
        } else {
            statusIndicator.className = 'status-indicator indicator-high';
            progressBar.className = 'queue-progress-bar progress-high';
            queueLoadText.className = 'queue-load-text high-load';
            
            if (document.documentElement.lang === 'zh') {
                queueLoadText.textContent = '高负载';
            } else {
                queueLoadText.textContent = 'High Load';
            }
        }
        
    } catch (error) {
        console.error('Error updating queue status:', error);
    }
}

// 处理操场表单提交
async function handlePlaygroundSubmit() {
    // 获取表单数据
    const text = document.getElementById('playground-text').value.trim();
    const voice = document.getElementById('playground-voice').value;
    const instructions = document.getElementById('playground-instructions').value.trim();
    
    // 验证文本不为空
    if (!text) {
        showPlaygroundStatus('error', document.documentElement.lang === 'zh' ? '请输入要转换的文本' : 'Please enter text to convert');
        return;
    }
    
    // 显示处理中状态
    showPlaygroundStatus('loading', document.documentElement.lang === 'zh' ? '生成中...' : 'Generating...');
    
    // 禁用提交按钮
    const submitButton = document.getElementById('playground-submit');
    submitButton.disabled = true;
    
    try {
        // 准备请求数据
        const requestData = {
            input: text,
            voice: voice
        };
        
        // 如果有指令，则添加
        if (instructions) {
            requestData.instructions = instructions;
        }
        
        // 发送请求
        const response = await fetch('/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        // 处理响应
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error generating speech');
        }
        
        // 获取音频数据
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // 创建音频元素
        const audio = document.createElement('audio');
        audio.className = 'audio-player';
        audio.controls = true;
        audio.autoplay = false;
        audio.src = audioUrl;
        
        // 显示音频元素
        const audioContainer = document.getElementById('playground-audio');
        audioContainer.innerHTML = '';
        audioContainer.appendChild(audio);
        
        // 显示成功状态
        showPlaygroundStatus('success', document.documentElement.lang === 'zh' ? '生成成功！' : 'Generation successful!');
        
    } catch (error) {
        console.error('Error generating speech:', error);
        showPlaygroundStatus('error', error.message || (document.documentElement.lang === 'zh' ? '生成失败' : 'Generation failed'));
    } finally {
        // 恢复提交按钮
        submitButton.disabled = false;
    }
}

// 显示操场状态
function showPlaygroundStatus(type, message) {
    const statusElement = document.getElementById('playground-status');
    statusElement.innerHTML = message;
    
    // 设置状态类
    statusElement.className = 'playground-status';
    if (type === 'error') {
        statusElement.classList.add('error');
    } else if (type === 'success') {
        statusElement.classList.add('success');
    } else if (type === 'loading') {
        statusElement.innerHTML = `<div class="loading-spinner"></div> ${message}`;
    }
} 