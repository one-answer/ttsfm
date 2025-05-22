/**
 * 全局错误处理与网站健康检查脚本
 * 版本: 1.0.0
 * 用途: 处理常见的网站错误，包括403拒绝访问、样式加载失败等
 */

(function() {
    // 当前版本
    const VERSION = '1.0.0';

    // 配置
    const CONFIG = {
        // 样式检测延迟时间(毫秒)
        styleCheckDelay: 8000,

        // 健康检查延迟(毫秒)
        healthCheckDelay: 3000,

        // API健康检查URL
        healthCheckUrl: '/api/queue-size',

        // 调试模式
        debug: true,

        // 错误页面URLs
        errorPages: {
            styleError: {
                en: 'styles-error-en.html',
                zh: 'styles-error-en.html'
            },
            accessDenied: {
                en: 'access-denied-en.html',
                zh: 'access-denied-en.html'
            }
        },

        // 错误消息翻译
        errorMessages: {
            en: {
                accessDenied: 'Access Denied (403)',
                accessDeniedDesc: 'You don\'t have permission to access this resource. Please check configuration or contact administrator.',
                networkError: 'Network Error',
                networkErrorDesc: 'Unable to connect to the server. Please check your network connection.'
            },
            zh: {
                accessDenied: '访问被拒绝 (403)',
                accessDeniedDesc: '您当前无权访问此资源。请检查配置或联系管理员。',
                networkError: '网络错误',
                networkErrorDesc: '无法连接到服务器。请检查您的网络连接。'
            }
        }
    };

    // 日志函数
    function log(message, type = 'info') {
        if (CONFIG.debug) {
            const timestamp = new Date().toISOString();
            const logPrefix = `[TTSFM ${timestamp}]`;

            switch(type) {
                case 'error':
                    console.error(`${logPrefix} ERROR:`, message);
                    break;
                case 'warn':
                    console.warn(`${logPrefix} WARNING:`, message);
                    break;
                default:
                    console.log(`${logPrefix} INFO:`, message);
            }
        }
    }

    // 获取当前语言 - 与单一HTML文件架构兼容
    function getCurrentLanguage() {
        // 首先从全局语言变量获取
        if (window.currentLang) {
            return window.currentLang;
        }
        // 然后从HTML lang属性获取，默认为英文
        return document.documentElement.lang === 'zh' ? 'zh' : 'en';
    }

    // 获取翻译文本
    function getTranslatedMessage(key) {
        const lang = getCurrentLanguage();
        if (CONFIG.errorMessages[lang] && CONFIG.errorMessages[lang][key]) {
            return CONFIG.errorMessages[lang][key];
        }
        return CONFIG.errorMessages.en[key] || key;
    }

    // 检查样式是否正确加载
    function checkStylesLoaded() {
        log('开始检查样式加载状态...');

        setTimeout(function() {
            try {
                // 标题元素检查
                const mainHeader = document.querySelector('.main-header h1');
                if (!mainHeader) {
                    log('未找到.main-header h1元素', 'warn');
                    return;
                }

                const headerStyle = getComputedStyle(mainHeader);
                log(`标题样式 - 颜色: ${headerStyle.color}, 背景: ${headerStyle.backgroundImage}`);

                // 内容包装器检查
                const contentWrapper = document.querySelector('.content-wrapper');
                if (!contentWrapper) {
                    log('未找到.content-wrapper元素', 'warn');
                    return;
                }

                const wrapperStyle = getComputedStyle(contentWrapper);
                log(`内容包装器样式 - 背景色: ${wrapperStyle.backgroundColor}, 阴影: ${wrapperStyle.boxShadow}`);

                // 样式加载失败检测条件
                const stylesFailed = (
                    // 标题检查
                    (headerStyle.color === 'rgb(0, 0, 0)' ||
                     headerStyle.color === 'rgb(51, 51, 51)') &&
                    // 不包含渐变背景
                    !headerStyle.backgroundImage.includes('gradient') &&
                    // 内容包装器检查
                    (wrapperStyle.backgroundColor === 'rgba(0, 0, 0, 0)' ||
                     wrapperStyle.boxShadow === 'none')
                );

                if (stylesFailed) {
                    log('样式未正确加载，准备跳转到错误页面', 'error');

                    // 重定向到相应的错误页面
                    const lang = getCurrentLanguage();
                    // 添加当前语言作为URL参数，以便错误页面也能正确显示语言
                    const errorUrl = CONFIG.errorPages.styleError[lang] + '?lang=' + lang;
                    window.location.href = errorUrl;
                } else {
                    log('样式已正确加载');
                }
            } catch (error) {
                log(`样式检测出错: ${error.message}`, 'error');
            }
        }, CONFIG.styleCheckDelay);
    }

    // 检查API访问是否被拒绝 (403错误)
    function checkApiAccess() {
        log('开始检查API访问权限...');

        setTimeout(function() {
            fetch(CONFIG.healthCheckUrl)
                .then(response => {
                    log(`API响应状态码: ${response.status}`);

                    if (response.status === 403) {
                        log('API访问被拒绝 (403)', 'error');

                        // 创建错误显示 - 使用当前语言
                        showErrorNotice(
                            getTranslatedMessage('accessDenied'),
                            getTranslatedMessage('accessDeniedDesc')
                        );
                    }
                })
                .catch(error => {
                    log(`API访问错误: ${error.message}`, 'error');

                    // 检查是否为网络错误
                    if (error.message.includes('Failed to fetch') ||
                        error.message.includes('NetworkError')) {
                        showErrorNotice(
                            getTranslatedMessage('networkError'),
                            getTranslatedMessage('networkErrorDesc')
                        );
                    }
                });
        }, CONFIG.healthCheckDelay);
    }

    // 显示错误通知
    function showErrorNotice(title, message) {
        // 检查是否已存在错误通知
        if (document.getElementById('ttsfm-error-notice')) {
            return;
        }

        const notice = document.createElement('div');
        notice.id = 'ttsfm-error-notice';
        notice.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            max-width: 400px;
            background: #fee2e2;
            color: #b91c1c;
            border: 1px solid #f87171;
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 9999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        `;

        notice.innerHTML = `
            <div style="display: flex; align-items: start;">
                <div style="margin-right: 10px; font-size: 24px;">⚠️</div>
                <div>
                    <h3 style="margin: 0 0 8px 0; font-size: 16px;">${title}</h3>
                    <p style="margin: 0; font-size: 14px;">${message}</p>
                </div>
            </div>
            <button id="ttsfm-error-close" style="
                position: absolute;
                top: 5px;
                right: 5px;
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                color: #b91c1c;
            ">×</button>
        `;

        document.body.appendChild(notice);

        // 添加关闭按钮事件
        document.getElementById('ttsfm-error-close').addEventListener('click', function() {
            notice.remove();
        });

        // 5秒后自动消失
        setTimeout(() => {
            notice.style.opacity = '0';
            notice.style.transition = 'opacity 0.5s ease';

            setTimeout(() => {
                notice.remove();
            }, 500);
        }, 5000);
    }

    // 初始化函数
    function init() {
        log(`错误处理脚本初始化 (v${VERSION})`);

        // 为所有AJAX请求添加错误处理
        const originalFetch = window.fetch;
        window.fetch = function() {
            return originalFetch.apply(this, arguments)
                .then(response => {
                    if (response.status === 403) {
                        log(`检测到403错误: ${arguments[0]}`, 'error');
                    }
                    return response;
                })
                .catch(error => {
                    log(`Fetch错误: ${error.message}`, 'error');
                    throw error;
                });
        };

        // 全局错误处理
        window.addEventListener('error', function(event) {
            log(`全局错误: ${event.message} at ${event.filename}:${event.lineno}`, 'error');
        });

        // 未捕获的Promise错误
        window.addEventListener('unhandledrejection', function(event) {
            log(`未处理的Promise拒绝: ${event.reason}`, 'error');
        });

        // 页面加载完成后检查
        window.addEventListener('load', function() {
            log('页面加载完成，开始健康检查...');
            checkStylesLoaded();
            checkApiAccess();
        });

        // 监听语言变化 - 与新的单一HTML架构集成
        if (window.addEventListener) {
            // 创建一个自定义事件来监听语言变化
            document.addEventListener('languageChanged', function(e) {
                log(`语言已更改为: ${e.detail.language}`);
                // 不需要特别操作，因为getCurrentLanguage()会自动获取最新语言
            });
        }
    }

    // 启动
    init();
})();