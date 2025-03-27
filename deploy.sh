#!/bin/bash
VERSION=${1:-v2}

# 确保静态文件拥有正确的权限
chmod -R 755 ./static

echo "开始构建Docker镜像..."
docker build --no-cache --pull .  -t aolifu/ttsfm:$VERSION

echo "推送镜像到Docker Hub..."
docker push aolifu/ttsfm:$VERSION

echo "停止并移除旧容器..."
docker stop ttsfm || true
docker rm ttsfm || true

echo "启动新容器..."
docker run -d --name ttsfm -p 11017:7000 aolifu/ttsfm:$VERSION

echo "部署完成! 版本: $VERSION"