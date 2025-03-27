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

# 验证错误处理脚本存在
if [ ! -f "./static/error-handler.js" ]; then
  echo "警告: 未找到错误处理脚本，请确保error-handler.js文件已创建"
fi

# 强制更新版本标识符
TIMESTAMP=$(date +%s)
echo "更新版本标识符: $TIMESTAMP"

# 1. 更新CSS文件中的版本注释
sed -i'.bak' "s/\/\* Version:.* \*\//\/* Version: $TIMESTAMP *\//" ./static/styles.css || true

# 2. 更新JavaScript文件中的版本常量
sed -i'.bak' "s/const VERSION = '.*';/const VERSION = '$TIMESTAMP';/" ./static/script.js || true
# 更新错误处理脚本中的版本
if [ -f "./static/error-handler.js" ]; then
  sed -i'.bak' "s/const VERSION = '.*';/const VERSION = '$TIMESTAMP';/" ./static/error-handler.js || true
fi

# 3. 更新HTML文件中的版本参数
for file in ./static/*.html; do
  if [[ -f "$file" ]]; then
    sed -i'.bak' "s/styles\.css?v=[0-9\.]\+/styles.css?v=$TIMESTAMP/g" "$file" || true
    sed -i'.bak' "s/script\.js?v=[0-9\.]\+/script.js?v=$TIMESTAMP/g" "$file" || true
    sed -i'.bak' "s/logo\.svg?v=[0-9\.]\+/logo.svg?v=$TIMESTAMP/g" "$file" || true
    sed -i'.bak' "s/error-handler\.js?v=[0-9\.]\+/error-handler.js?v=$TIMESTAMP/g" "$file" || true
    
    # 输出处理结果
    echo "  已更新版本标识: $file"
  fi
done

# 清理备份文件
find ./static -name "*.bak" -delete || true

echo "创建 Dockerfile..."
cat > Dockerfile << EOL
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# 确保文件权限正确，解决403错误
RUN chmod -R 755 /app/static
# 确保Web服务器用户可以访问所有文件
RUN chown -R nobody:nogroup /app/static
# 确保错误页面可访问
RUN chmod 755 /app/static/*.html

# 添加健康检查
HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD wget -O - http://localhost:7000/health || exit 1

EXPOSE 7000

CMD ["python", "server.py"]
EOL

echo "开始构建 Docker 镜像..."
docker build --no-cache --pull . -t aolifu/ttsfm:$VERSION

echo "推送镜像到 Docker Hub..."
docker push aolifu/ttsfm:$VERSION

echo "启动新容器..."
docker run -d --name ttsfm -p 11017:7000 aolifu/ttsfm:$VERSION

# 验证容器启动状态
echo "验证容器状态..."
sleep 3
if [ "$(docker ps -q -f name=ttsfm)" ]; then
    echo "容器已成功启动"
    
    # 检查网站可访问性
    echo "检查网站可访问性..."
    if curl -s http://localhost:11017 > /dev/null; then
        echo "网站可以正常访问"
    else
        echo "警告: 无法访问网站，可能存在配置问题"
    fi
    
    # 检查文件权限
    echo "检查容器内文件权限..."
    docker exec ttsfm ls -la /app/static/ | head -n 5
    
    # 测试样式文件可访问性
    echo "测试样式文件可访问性..."
    STYLE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:11017/styles.css)
    if [ "$STYLE_STATUS" = "200" ]; then
        echo "样式文件可以正常访问"
    elif [ "$STYLE_STATUS" = "403" ]; then
        echo "错误: 样式文件返回403权限错误，尝试修复问题..."
        echo "修改容器内文件权限..."
        docker exec ttsfm chmod -R 755 /app/static
        echo "重新测试样式文件..."
        STYLE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:11017/styles.css)
        if [ "$STYLE_STATUS" = "200" ]; then
            echo "样式文件权限问题已修复"
        else
            echo "样式文件仍然存在问题，状态码: $STYLE_STATUS"
        fi
    else
        echo "样式文件状态异常，状态码: $STYLE_STATUS"
    fi
else
    echo "错误: 容器启动失败，请检查Docker日志"
    docker logs ttsfm
fi

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
echo "4. 如果遇到403错误，可使用./troubleshoot.sh脚本诊断并修复"
echo "" 