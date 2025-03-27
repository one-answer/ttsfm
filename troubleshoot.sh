#!/bin/bash

echo "===== TTSFM 网站故障排查工具 ====="
echo "此脚本将帮助诊断和解决样式文件加载问题"
echo ""

# 检查Docker容器状态
echo "1. 检查Docker容器状态..."
CONTAINER_STATUS=$(docker ps -a --filter "name=ttsfm" --format "{{.Status}}")

if [ -z "$CONTAINER_STATUS" ]; then
  echo "   [警告] 未找到ttsfm容器!"
  echo "   建议执行: ./deploy.sh 或 ./clean_deploy.sh"
else
  echo "   [信息] 容器状态: $CONTAINER_STATUS"
  
  if [[ "$CONTAINER_STATUS" == *"Up"* ]]; then
    echo "   [成功] 容器正在运行"
    
    # 获取容器内静态文件信息
    echo ""
    echo "2. 检查容器内的静态文件..."
    echo "   列出容器内的HTML文件:"
    docker exec ttsfm ls -la /app/static/*.html || echo "   [错误] 无法列出容器内的HTML文件"
    
    echo ""
    echo "   列出容器内的CSS文件:"
    docker exec ttsfm ls -la /app/static/*.css || echo "   [错误] 无法列出容器内的CSS文件"
    
    echo ""
    echo "   列出容器内的JS文件:"
    docker exec ttsfm ls -la /app/static/*.js || echo "   [错误] 无法列出容器内的JS文件"
    
    echo ""
    echo "3. 检查容器日志最近的错误..."
    docker logs ttsfm --tail 20 | grep -i "error\|warn\|except" || echo "   [信息] 未发现明显错误"
    
    echo ""
    echo "4. 测试网站可访问性..."
    CURL_RESULT=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:11017/)
    if [ "$CURL_RESULT" = "200" ]; then
      echo "   [成功] 网站返回200状态码"
      echo "   网站已可访问: http://localhost:11017/"
    else
      echo "   [警告] 网站返回状态码: $CURL_RESULT"
      echo "   网站可能无法正常访问"
    fi
  else
    echo "   [警告] 容器未运行!"
    echo "   建议执行: docker start ttsfm 或 ./clean_deploy.sh"
  fi
fi

echo ""
echo "5. 检查本地静态文件版本信息..."
CSS_VERSION=$(grep "Version:" ./static/styles.css || echo "未找到版本信息")
JS_VERSION=$(grep "VERSION =" ./static/script.js || echo "未找到版本信息")
echo "   CSS版本: $CSS_VERSION"
echo "   JS版本: $JS_VERSION" 

echo ""
echo "===== 诊断完成 ====="
echo ""
echo "如果您仍然看到旧版本的样式，请尝试以下解决方案:"
echo "1. 清除浏览器缓存后再访问"
echo "2. 在浏览器地址栏中添加参数，如: http://localhost:11017/?nocache=$(date +%s)"
echo "3. 使用浏览器开发工具检查网络请求，确认加载的样式文件是最新的"
echo "4. 运行 ./clean_deploy.sh 脚本进行完全重新部署"
echo "5. 检查服务器日志以查找更多详细信息: docker logs ttsfm"
echo "" 