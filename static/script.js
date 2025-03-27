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

// 使用在HTML中定义的语言（通过i18n系统）
// 这些翻译已经在HTML中定义，这里只定义额外需要的翻译
const additionalTranslations = {
    en: {
        "processing": "Processing...",
        "idle": "Idle",
        "generating": "Generating audio...",
        "error": "Error",
        "success": "Audio generated successfully!",
        "empty-text": "Please enter some text to convert",
        "network-error": "Network error. Please try again later."
    },
    zh: {
        "processing": "处理中...",
        "idle": "空闲",
        "generating": "正在生成音频...",
        "error": "错误",
        "success": "音频生成成功！",
        "empty-text": "请输入要转换的文本",
        "network-error": "网络错误，请稍后重试。"
    }
};

// 获取翻译文本的函数
function getTranslation(key) {
    // 首先从HTML中定义的i18n对象获取翻译
    if (window.i18n && window.i18n[currentLang] && window.i18n[currentLang][key]) {
        return window.i18n[currentLang][key];
    }
    // 然后尝试从本地定义的additionalTranslations获取
    if (additionalTranslations[currentLang] && additionalTranslations[currentLang][key]) {
        return additionalTranslations[currentLang][key];
    }
    // 如果没有找到翻译，返回英文版本或键名
    return additionalTranslations.en[key] || key;
}

// 当声明一个页面暂用的语言变量时，从全局获取而不是重新定义
function getCurrentLanguage() {
    return window.currentLang || 'en';
}

function updateProcessingStatus(requestCount) {
    if (requestCount > 0) {
        processingStatus.textContent = getTranslation('processing');
        processingStatus.className = 'processing';
    } else {
        processingStatus.textContent = getTranslation('idle');
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
        queueLoadText.textContent = getTranslation('error');
    }
}

// Function to update load status indicators
function updateLoadStatus(loadPercentage) {
    // 获取当前语言
    const lang = getCurrentLanguage();
    
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
        queueLoadText.textContent = getTranslation('highLoad');
    } else if (loadPercentage >= 40) {
        // Medium load (40-75%)
        statusIndicator.classList.add('indicator-medium');
        queueProgressBar.classList.add('progress-medium');
        queueLoadText.classList.add('medium-load');
        queueLoadText.textContent = getTranslation('mediumLoad');
    } else {
        // Low load (0-40%)
        statusIndicator.classList.add('indicator-low');
        queueProgressBar.classList.add('progress-low');
        queueLoadText.classList.add('low-load');
        queueLoadText.textContent = loadPercentage > 0 ? getTranslation('lowLoad') : getTranslation('no-load');
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

// 初始化函数 - 页面加载时执行
document.addEventListener('DOMContentLoaded', function() {
    const submitButton = document.getElementById('playground-submit');
    const textInput = document.getElementById('playground-text');
    const voiceSelect = document.getElementById('playground-voice');
    const instructionsInput = document.getElementById('playground-instructions');
    const statusDiv = document.getElementById('playground-status');
    const audioDiv = document.getElementById('playground-audio');
    
    // 为提交按钮添加事件监听
    if (submitButton) {
        submitButton.addEventListener('click', handlePlaygroundSubmit);
    }
    
    // 为复制按钮添加事件监听
    const copyButtons = document.querySelectorAll('.copy-button');
    copyButtons.forEach(button => {
        button.addEventListener('click', function() {
            copyCode(this);
        });
    });
    
    // 初始更新队列状态
    updateQueueSize();
    
    // 辅助函数显示状态信息
    function showStatus(message, type) {
        if (statusDiv) {
            statusDiv.textContent = message;
            statusDiv.className = 'playground-status ' + (type || '');
        }
    }
});

// 添加版本参数到URL，防止缓存
function addVersionParam(url) {
    const timestamp = new Date().getTime();
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${timestamp}`;
}

// 播放场景提交处理函数
async function handlePlaygroundSubmit() {
    const textInput = document.getElementById('playground-text');
    const voiceSelect = document.getElementById('playground-voice');
    const instructionsInput = document.getElementById('playground-instructions');
    const statusDiv = document.getElementById('playground-status');
    const audioDiv = document.getElementById('playground-audio');
    const submitButton = document.getElementById('playground-submit');
    
    // 检查输入
    if (!textInput.value.trim()) {
        showPlaygroundStatus('error', getTranslation('empty-text'));
        return;
    }
    
    // 禁用按钮，显示加载状态
    submitButton.disabled = true;
    showPlaygroundStatus('', getTranslation('generating'));
    
    // 准备API请求数据
    const requestData = {
        model: "tts-1",
        voice: voiceSelect.value,
        input: textInput.value.trim()
    };
    
    // 添加指令如果有的话
    if (instructionsInput.value.trim()) {
        requestData.instructions = instructionsInput.value.trim();
    }
    
    try {
        // 发送API请求
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        // 处理响应
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // 获取音频blob
        const audioBlob = await response.blob();
        
        // 创建音频URL
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // 显示音频播放器
        audioDiv.innerHTML = `
            <audio controls autoplay class="audio-player">
                <source src="${audioUrl}" type="audio/mpeg">
                Your browser does not support the audio element.
            </audio>
            <a href="${audioUrl}" download="tts_audio.mp3" class="playground-button">
                <i class="fas fa-download"></i> Download
            </a>
        `;
        
        // 显示成功状态
        showPlaygroundStatus('success', getTranslation('success'));
        
    } catch (error) {
        console.error('Error generating speech:', error);
        showPlaygroundStatus('error', getTranslation('network-error'));
    } finally {
        // 重新启用按钮
        submitButton.disabled = false;
    }
}

// 显示播放区域状态信息
function showPlaygroundStatus(type, message) {
    const statusDiv = document.getElementById('playground-status');
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = 'playground-status ' + (type || '');
    }
} 