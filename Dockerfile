# Use Python 3.13 slim image as base
FROM python:3.13-slim

# Set working directory
WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# 清除所有可能的缓存文件
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 创建所需的目录并设置权限
RUN mkdir -p /app/static && \
    chmod -R 755 /app

# 首先复制静态文件 - 确保前端资源最新
COPY static/ /app/static/
RUN chmod -R 755 /app/static

# 复制其他应用程序文件
COPY main.py .
COPY server/ server/
COPY utils/ utils/

# 设置默认环境变量
ENV HOST=0.0.0.0 \
    PORT=7000 \
    VERIFY_SSL=true \
    MAX_QUEUE_SIZE=100 \
    PYTHONUNBUFFERED=1

# 暴露端口7000
EXPOSE 7000

# 设置健康检查
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:7000/ || exit 1

# 启动应用程序
CMD ["python", "main.py"]