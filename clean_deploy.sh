#!/bin/bash
VERSION=${1:-v2}

echo "===== 彻底清理和重新部署 TTSFM 服务 ====="

# 停止所有相关容器
echo "停止相关容器..."
docker stop ttsfm || true
docker rm ttsfm || true

# 删除当前镜像以确保完全重建
echo "清理现有 Docker 镜像..."
docker rmi aolifu/ttsfm:$VERSION || true
docker system prune -f

# 清理静态资源目录
echo "清理静态资源文件缓存..."
find ./static -type f -name "*.gz" -delete
find ./static -type f -name "*.br" -delete
find ./static -type f -name ".DS_Store" -delete
find ./static -type f -name "*.tmp" -delete
find ./static -type f -name "*.bak" -delete

# 确保静态文件权限正确
echo "设置文件权限..."
chmod -R 755 ./static

# 强制更新版本标识符
TIMESTAMP=$(date +%s)
echo "更新版本标识符: $TIMESTAMP"

# 1. 更新CSS文件中的版本注释
sed -i'.bak' "s/\/\* Version:.* \*\//\/* Version: $TIMESTAMP *\//" ./static/styles.css || true

# 2. 更新JavaScript文件中的版本常量
sed -i'.bak' "s/const VERSION = '.*';/const VERSION = '$TIMESTAMP';/" ./static/script.js || true

# 3. 更新HTML文件中的版本参数
for file in ./static/*.html; do
  sed -i'.bak' "s/styles\.css?v=[0-9\.]\+/styles.css?v=$TIMESTAMP/g" "$file" || true
  sed -i'.bak' "s/script\.js?v=[0-9\.]\+/script.js?v=$TIMESTAMP/g" "$file" || true
  sed -i'.bak' "s/logo\.svg?v=[0-9\.]\+/logo.svg?v=$TIMESTAMP/g" "$file" || true
done

# 清理备份文件
find ./static -name "*.bak" -delete || true

echo "开始构建 Docker 镜像..."
docker build --no-cache --pull . -t aolifu/ttsfm:$VERSION

echo "推送镜像到 Docker Hub..."
docker push aolifu/ttsfm:$VERSION

echo "启动新容器..."
docker run -d --name ttsfm -p 11017:7000 aolifu/ttsfm:$VERSION

echo "===== 部署完成! ====="
echo "镜像版本: $VERSION"
echo "静态资源版本: $TIMESTAMP"
echo "服务地址: http://localhost:11017"

# 添加提示
echo ""
echo "重要提示:"
echo "1. 如果您在访问网站时仍然看到旧版本，请尝试强制刷新浏览器 (Ctrl+F5 或 Cmd+Shift+R)"
echo "2. 或者尝试清除浏览器缓存后再访问"
echo "3. 也可以尝试在浏览器的隐身模式下访问"
echo "" 