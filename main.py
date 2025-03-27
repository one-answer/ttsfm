"""
OpenAI TTS API Server

This module provides a server that's compatible with OpenAI's TTS API format.
This is the main entry point for the application.
"""

import asyncio
import aiohttp
import logging
import ssl
import time
import sys
import os
from pathlib import Path
from typing import Optional
from aiohttp import TCPConnector, ClientTimeout

from utils.config import load_config, test_connection
from server.api import TTSServer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 记录环境信息，帮助调试
def log_environment_info():
    """记录运行环境信息，帮助调试。"""
    logger.info(f"Python version: {sys.version}")
    logger.info(f"Current working directory: {os.getcwd()}")
    
    # 检查静态文件目录
    static_paths = [
        Path.cwd() / 'static',
        Path(__file__).parent / 'static',
        Path('/app/static') if os.path.exists('/app') else None
    ]
    
    for path in static_paths:
        if path and path.exists():
            logger.info(f"Static directory found at: {path}")
            # 列出静态目录中的一些关键文件
            try:
                files = list(path.glob('*.html')) + list(path.glob('*.css')) + list(path.glob('*.js'))
                logger.info(f"Static files found: {[f.name for f in files]}")
            except Exception as e:
                logger.warning(f"Error listing static files: {e}")
        elif path:
            logger.warning(f"Static directory not found at: {path}")

async def create_test_session(verify_ssl: bool = True) -> Optional[aiohttp.ClientSession]:
    """Create a session for testing with optimized settings."""
    try:
        if not verify_ssl:
            connector = TCPConnector(
                ssl=False,
                limit=5,
                ttl_dns_cache=300,
                use_dns_cache=True,
                enable_cleanup_closed=True
            )
        else:
            connector = TCPConnector(
                limit=5,
                ttl_dns_cache=300,
                use_dns_cache=True,
                enable_cleanup_closed=True
            )
            
        timeout = ClientTimeout(
            total=30,
            connect=10,
            sock_read=20
        )
        
        return aiohttp.ClientSession(
            connector=connector,
            timeout=timeout
        )
    except Exception as e:
        logger.error(f"Failed to create test session: {str(e)}")
        return None

async def main():
    """Main function to start the server."""
    try:
        # 记录环境信息
        log_environment_info()
        
        config = load_config()
        logger.info(f"Loaded configuration: {config}")
        
        # Test connection mode
        if config.get('test_connection', False):
            session = await create_test_session(config['verify_ssl'])
            if not session:
                logger.error("Failed to create test session")
                sys.exit(1)
                
            try:
                await test_connection(session)
            except Exception as e:
                logger.error(f"Connection test failed: {str(e)}")
                sys.exit(1)
            finally:
                await session.close()
                
            logger.info("Connection test completed successfully")
            return
        
        # Start the server
        server = TTSServer(
            host=config['host'],
            port=config['port'],
            verify_ssl=config['verify_ssl'],
            max_queue_size=config['max_queue_size']
        )
        
        await server.start()
        
        try:
            # Keep the server running
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            logger.info("Received shutdown signal")
            await server.stop()
            logger.info("TTS server stopped gracefully")
        except Exception as e:
            logger.error(f"Server error: {str(e)}")
            await server.stop()
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"Fatal error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Process interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Process terminated due to error: {str(e)}")
        sys.exit(1) 