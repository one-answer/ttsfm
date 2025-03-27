"""
HTTP Request Handlers

This module contains the API endpoint handlers for the TTS server.
"""

import json
import time
import logging
import asyncio
import aiohttp
import random
import uuid
from aiohttp import web
from pathlib import Path
from typing import Dict, Any, List
from fake_useragent import UserAgent
from collections import defaultdict
from datetime import datetime, timedelta
from utils.config import load_config

logger = logging.getLogger(__name__)
ua = UserAgent()

# Load configuration
config = load_config()

# Rate limiting per IP
RATE_LIMIT_WINDOW = config['rate_limit_window']  # seconds
MAX_REQUESTS_PER_WINDOW = config['rate_limit_requests']
ip_request_counts = defaultdict(list)

def _get_headers() -> Dict[str, str]:
    """Generate more realistic browser headers with rotation"""
    browsers = [
        {
            "User-Agent": ua.chrome,
            "Sec-Ch-Ua": '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
        },
        {
            "User-Agent": ua.firefox,
            "Sec-Ch-Ua": '"Not A(Brand";v="8", "Chromium";v="121"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
        },
        {
            "User-Agent": ua.edge,
            "Sec-Ch-Ua": '"Not A(Brand";v="8", "Chromium";v="121", "Microsoft Edge";v="121"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
        }
    ]
    
    browser = random.choice(browsers)
    return {
        "Authority": "www.openai.fm",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Dnt": "1",
        "Referer": "https://www.openai.fm/",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "X-Requested-With": "XMLHttpRequest",
        **browser
    }

def _get_random_delay() -> float:
    """Get random delay time (1-5 seconds) with jitter"""
    base_delay = random.uniform(1, 5)
    jitter = random.uniform(0.1, 0.5)
    return base_delay + jitter

def _is_rate_limited(ip: str) -> bool:
    """Check if IP is rate limited"""
    now = datetime.now()
    window_start = now - timedelta(seconds=RATE_LIMIT_WINDOW)
    
    # Clean old requests
    ip_request_counts[ip] = [t for t in ip_request_counts[ip] if t > window_start]
    
    # Check if rate limited
    if len(ip_request_counts[ip]) >= MAX_REQUESTS_PER_WINDOW:
        return True
    
    # Add current request
    ip_request_counts[ip].append(now)
    return False

async def handle_openai_speech(request: web.Request, queue, session=None) -> web.Response:
    """Handle POST requests to /v1/audio/speech (OpenAI compatible API)."""
    try:
        # Rate limiting check
        client_ip = request.remote
        if _is_rate_limited(client_ip):
            return web.Response(
                text=json.dumps({
                    "error": "Rate limit exceeded. Please try again later.",
                    "retry_after": RATE_LIMIT_WINDOW
                }),
                status=429,
                content_type="application/json",
                headers={"Retry-After": str(RATE_LIMIT_WINDOW)}
            )

        # Check if queue is full
        if queue.full():
            return web.Response(
                text=json.dumps({
                    "error": "Queue is full. Please try again later.",
                    "queue_size": queue.qsize()
                }),
                status=429,
                content_type="application/json"
            )

        # Read JSON data
        body = await request.json()
        
        # Map OpenAI format to our internal format
        openai_fm_data = {}
        content_type = "audio/mpeg"
        
        # Required parameters
        if 'input' not in body or 'voice' not in body:
            return web.Response(
                text=json.dumps({"error": "Missing required parameters: input and voice"}),
                status=400,
                content_type="application/json"
            )
        
        openai_fm_data['input'] = body['input']
        openai_fm_data['voice'] = body['voice']
        
        # Map 'instructions' to 'prompt' if provided
        if 'instructions' in body:
            openai_fm_data['prompt'] = body['instructions']
        
        # Check for response_format
        if 'response_format' in body:
            format_mapping = {
                'mp3': 'audio/mpeg',
                'opus': 'audio/opus',
                'aac': 'audio/aac',
                'flac': 'audio/flac',
                'wav': 'audio/wav',
                'pcm': 'audio/pcm'
            }
            content_type = format_mapping.get(body['response_format'], 'audio/mpeg')
        
        # Create response future
        response_future = asyncio.Future()
        
        # Create task data
        task_data = {
            'data': openai_fm_data,
            'content_type': content_type,
            'response_future': response_future,
            'timestamp': time.time(),
            'client_ip': client_ip
        }
        
        # Add to queue
        await queue.put(task_data)
        logger.info(f"Added task to queue. Current size: {queue.qsize()}")
        
        # Wait for response
        return await response_future
                
    except json.JSONDecodeError:
        return web.Response(
            text=json.dumps({"error": "Invalid JSON in request body"}),
            status=400,
            content_type="application/json"
        )
    except Exception as e:
        logger.error(f"Error handling request: {str(e)}")
        return web.Response(
            text=json.dumps({"error": str(e)}),
            status=500,
            content_type="application/json",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization"
            }
        )
            
async def process_tts_request(task_data: Dict[str, Any], session) -> web.Response:
    """Process a single TTS request."""
    max_retries = 3
    retry_count = 0
    base_delay = 1
    
    while retry_count < max_retries:
        try:
            # Add random delay between requests
            await asyncio.sleep(_get_random_delay())
            
            logger.info(f"Sending request to OpenAI.fm with data: {task_data['data']}")
            
            # Add generation ID to request data
            task_data['data']['generation'] = str(uuid.uuid4())
            
            request_kwargs = {
                "data": task_data['data'],
                "headers": _get_headers(),
                "timeout": 30
            }
            
            async with session.post(
                "https://www.openai.fm/api/generate",
                **request_kwargs
            ) as response:
                if response.status == 403:
                    logger.warning("Received 403 Forbidden from OpenAI.fm")
                    retry_count += 1
                    await asyncio.sleep(base_delay * (2 ** retry_count))  # Exponential backoff
                    continue
                
                if response.status == 429:
                    logger.warning("Rate limited by OpenAI.fm")
                    retry_after = int(response.headers.get('Retry-After', 60))
                    await asyncio.sleep(retry_after)
                    continue
                
                if response.status == 503:
                    logger.warning("Service unavailable from OpenAI.fm")
                    retry_count += 1
                    await asyncio.sleep(base_delay * (2 ** retry_count))
                    continue
                
                audio_data = await response.read()
                
                if response.status != 200:
                    logger.error(f"Error from OpenAI.fm: {response.status}")
                    error_msg = f"Error from upstream service: {response.status}"
                    return web.Response(
                        text=json.dumps({"error": error_msg}),
                        status=response.status,
                        content_type="application/json"
                    )
                
                return web.Response(
                    body=audio_data,
                    content_type=task_data['content_type'],
                    headers={
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "POST, OPTIONS",
                        "Access-Control-Allow-Headers": "Content-Type, Authorization"
                    }
                )
        except asyncio.TimeoutError:
            logger.error("Request timeout")
            retry_count += 1
            await asyncio.sleep(base_delay * (2 ** retry_count))
        except aiohttp.ClientError as e:
            logger.error(f"Network error: {str(e)}")
            retry_count += 1
            await asyncio.sleep(base_delay * (2 ** retry_count))
        except Exception as e:
            logger.error(f"Error processing TTS request: {str(e)}")
            retry_count += 1
            await asyncio.sleep(base_delay * (2 ** retry_count))
            if retry_count >= max_retries:
                return web.Response(
                    text=json.dumps({"error": str(e)}),
                    status=500,
                    content_type="application/json"
                )
            
    # If we've exhausted retries
    logger.error("Exhausted retries for TTS request")
    return web.Response(
        text=json.dumps({"error": "Failed to process request after multiple retries"}),
        status=500,
        content_type="application/json"
    )

async def handle_queue_size(request: web.Request, queue) -> web.Response:
    """Handle GET requests to /api/queue-size."""
    try:
        # Get current queue size and max size
        current_size = queue.qsize()
        max_size = queue.maxsize if hasattr(queue, 'maxsize') else 100  # Fallback to 100 if maxsize not set
        
        # Ensure values are valid
        if current_size < 0:
            current_size = 0
        if max_size < 1:
            max_size = 100  # Default to 100 if invalid
            
        return web.json_response({
            "queue_size": current_size,
            "max_queue_size": max_size
        }, headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        })
    except Exception as e:
        logger.error(f"Error getting queue size: {str(e)}")
        return web.json_response({
            "queue_size": 0,
            "max_queue_size": 100,  # Default values on error
            "error": "Failed to get queue status"
        }, status=500, headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        })
        
async def handle_static(request: web.Request) -> web.Response:
    """Handle static file requests.
    
    Args:
        request: The incoming request
        
    Returns:
        web.Response: The response to send back
    """
    try:
        # Get file path from request
        file_path = request.match_info['tail']
        if not file_path:
            file_path = 'index.html'
            
        # 日志记录请求的文件
        logger.debug(f"Static file request: {file_path}")
            
        # 构建文件的完整路径 - 支持多种可能的静态文件位置
        # 首先尝试从当前工作目录查找
        static_paths = [
            Path(__file__).parent.parent / 'static' / file_path,  # 相对于handlers.py的上级目录
            Path('/app/static') / file_path,  # Docker容器中的路径
            Path.cwd() / 'static' / file_path  # 当前工作目录
        ]
        
        # 尝试所有可能的路径
        full_path = None
        for path in static_paths:
            if path.exists():
                full_path = path
                logger.debug(f"Found static file at: {full_path}")
                break
                
        # 如果文件不存在
        if not full_path:
            logger.warning(f"Static file not found: {file_path} (tried paths: {[str(p) for p in static_paths]})")
            
            # 如果请求的是favicon.ico且不存在，返回204而不是404
            if file_path == 'favicon.ico':
                return web.Response(status=204)
                
            # 如果是根目录请求但index.html不存在，返回简单消息
            if file_path == 'index.html':
                return web.Response(
                    text="<html><body><h1>服务器正在运行</h1><p>但未找到index.html文件。</p></body></html>",
                    content_type="text/html"
                )
                
            return web.Response(text="Not found", status=404)
            
        # 缓存控制 - 防止浏览器缓存CSS和JS文件
        cache_headers = {}
        if full_path.suffix in ['.css', '.js']:
            cache_headers = {
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
            
        # 读取文件
        with open(full_path, 'rb') as f:
            content = f.read()
            
        # 确定内容类型
        content_type = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.gif': 'image/gif',
            '.ico': 'image/x-icon',
            '.svg': 'image/svg+xml',
            '.json': 'application/json',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.ttf': 'font/ttf',
            '.eot': 'application/vnd.ms-fontobject'
        }.get(full_path.suffix, 'application/octet-stream')
        
        # 返回响应
        return web.Response(
            body=content,
            content_type=content_type,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                **cache_headers
            }
        )
        
    except Exception as e:
        logger.error(f"Error serving static file: {str(e)}", exc_info=True)
        return web.Response(
            text=f"<html><body><h1>Server Error</h1><p>{str(e)}</p></body></html>",
            content_type="text/html",
            status=500
        )