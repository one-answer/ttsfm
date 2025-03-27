#!/bin/bash

echo "===== TTSFM 网站故障排查工具 ====="
echo "此脚本将帮助诊断和解决样式文件加载及403权限问题"
echo ""

# 颜色设置
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

function print_success() {
  echo -e "   ${GREEN}[成功]${NC} $1"
}

function print_warning() {
  echo -e "   ${YELLOW}[警告]${NC} $1" 
}

function print_error() {
  echo -e "   ${RED}[错误]${NC} $1"
}

function print_info() {
  echo -e "   ${BLUE}[信息]${NC} $1"
}

# 检查Docker容器状态
echo "1. 检查Docker容器状态..."
CONTAINER_STATUS=$(docker ps -a --filter "name=ttsfm" --format "{{.Status}}")

if [ -z "$CONTAINER_STATUS" ]; then
  print_warning "未找到ttsfm容器!"
  print_info "建议执行: ./deploy.sh 或 ./clean_deploy.sh"
else
  print_info "容器状态: $CONTAINER_STATUS"
  
  if [[ "$CONTAINER_STATUS" == *"Up"* ]]; then
    print_success "容器正在运行"
    
    # 获取容器内静态文件信息
    echo ""
    echo "2. 检查容器内的静态文件..."
    echo "   列出容器内的HTML文件:"
    docker exec ttsfm ls -la /app/static/*.html || print_error "无法列出容器内的HTML文件"
    
    echo ""
    echo "   列出容器内的CSS文件:"
    docker exec ttsfm ls -la /app/static/*.css || print_error "无法列出容器内的CSS文件"
    
    echo ""
    echo "   列出容器内的JS文件:"
    docker exec ttsfm ls -la /app/static/*.js || print_error "无法列出容器内的JS文件"
    
    # 检查文件权限
    echo ""
    echo "3. 检查文件权限..."
    STATIC_PERMS=$(docker exec ttsfm stat -c "%a" /app/static 2>/dev/null || echo "无法获取")
    if [ "$STATIC_PERMS" != "无法获取" ] && [ "$STATIC_PERMS" -lt "755" ]; then
      print_error "静态文件目录权限不足: $STATIC_PERMS (应为755或更高)"
      print_info "自动修复目录权限..."
      docker exec ttsfm chmod -R 755 /app/static
      print_success "权限已修改"
    else
      print_success "目录权限正常: $STATIC_PERMS"
    fi
    
    echo ""
    echo "4. 检查容器日志最近的错误..."
    docker logs ttsfm --tail 20 | grep -i "error\|warn\|except\|denied\|permission\|403" || print_info "未发现明显错误"
    
    echo ""
    echo "5. 测试网站可访问性..."
    CURL_RESULT=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:11017/)
    if [ "$CURL_RESULT" = "200" ]; then
      print_success "网站主页返回200状态码"
      print_info "网站主页已可访问: http://localhost:11017/"
    elif [ "$CURL_RESULT" = "403" ]; then
      print_error "网站主页返回403访问被拒绝状态码"
      print_info "尝试修复403错误..."
      docker exec ttsfm chmod -R 755 /app/static
      docker exec ttsfm chown -R nobody:nogroup /app/static 2>/dev/null || true
      print_info "权限修复后重新测试..."
      CURL_RESULT2=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:11017/)
      if [ "$CURL_RESULT2" = "200" ]; then
        print_success "403错误已修复!"
      else
        print_error "修复尝试后网站仍返回状态码: $CURL_RESULT2"
      fi
    else
      print_warning "网站主页返回状态码: $CURL_RESULT"
      print_warning "网站可能无法正常访问"
    fi
    
    echo ""
    echo "6. 测试样式文件可访问性..."
    CSS_RESULT=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:11017/styles.css)
    if [ "$CSS_RESULT" = "200" ]; then
      print_success "样式文件返回200状态码"
      print_info "样式文件可正常访问"
    elif [ "$CSS_RESULT" = "403" ]; then
      print_error "样式文件返回403访问被拒绝状态码"
      print_info "尝试修复样式文件403错误..."
      docker exec ttsfm chmod 755 /app/static/styles.css
      print_info "权限修复后重新测试..."
      CSS_RESULT2=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:11017/styles.css)
      if [ "$CSS_RESULT2" = "200" ]; then
        print_success "样式文件403错误已修复!"
      else
        print_error "修复尝试后样式文件仍返回状态码: $CSS_RESULT2"
      fi
    else
      print_warning "样式文件返回状态码: $CSS_RESULT"
      print_warning "样式文件可能无法正常访问"
    fi
    
    echo ""
    echo "7. 检查错误处理脚本..."
    if docker exec ttsfm ls /app/static/error-handler.js > /dev/null 2>&1; then
      print_success "错误处理脚本存在"
      # 测试错误处理脚本可访问性
      EH_RESULT=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:11017/error-handler.js)
      if [ "$EH_RESULT" = "200" ]; then
        print_success "错误处理脚本可正常访问"
      elif [ "$EH_RESULT" = "403" ]; then
        print_error "错误处理脚本返回403访问被拒绝状态码"
        print_info "尝试修复脚本访问权限..."
        docker exec ttsfm chmod 755 /app/static/error-handler.js
        print_success "权限已修改"
      else
        print_warning "错误处理脚本返回状态码: $EH_RESULT"
      fi
    else
      print_warning "错误处理脚本不存在"
      print_info "建议运行 ./clean_deploy.sh 完全重新部署"
    fi
  else
    print_warning "容器未运行!"
    print_info "建议执行: docker start ttsfm 或 ./clean_deploy.sh"
  fi
fi

echo ""
echo "8. 检查本地静态文件版本信息..."
CSS_VERSION=$(grep "Version:" ./static/styles.css || echo "未找到版本信息")
JS_VERSION=$(grep "VERSION =" ./static/script.js || echo "未找到版本信息")
EH_VERSION=$(grep "VERSION =" ./static/error-handler.js 2>/dev/null || echo "未找到版本信息")
print_info "CSS版本: $CSS_VERSION"
print_info "JS版本: $JS_VERSION" 
print_info "错误处理脚本版本: $EH_VERSION"

echo ""
echo "9. Web服务器配置检查..."
if docker exec ttsfm which nginx > /dev/null 2>&1; then
  print_info "容器使用Nginx作为Web服务器"
  print_info "检查Nginx配置..."
  docker exec ttsfm nginx -t 2>&1 || print_error "Nginx配置测试失败"
  print_info "检查Nginx虚拟主机配置..."
  docker exec ttsfm cat /etc/nginx/conf.d/default.conf 2>/dev/null || 
  docker exec ttsfm cat /etc/nginx/sites-enabled/default 2>/dev/null ||
  print_warning "无法找到Nginx虚拟主机配置"
elif docker exec ttsfm which apache2 > /dev/null 2>&1; then
  print_info "容器使用Apache作为Web服务器"
  print_info "检查Apache配置..."
  docker exec ttsfm apachectl -t 2>&1 || print_error "Apache配置测试失败"
else
  print_info "容器可能使用内置Python服务器"
fi

echo ""
echo "===== 诊断完成 ====="
echo ""
echo "诊断结果摘要:"
if [ "$CURL_RESULT" = "200" ] && [ "$CSS_RESULT" = "200" ]; then
  echo -e "${GREEN}✓ 基本检查通过：网站主页和样式文件均可访问${NC}"
else
  echo -e "${RED}✗ 发现访问问题：网站(${CURL_RESULT})或样式文件(${CSS_RESULT})无法正常访问${NC}"
fi

echo ""
echo "如果仍然存在问题，请尝试以下解决方案:"
echo "1. 清除浏览器缓存后再访问"
echo "2. 在浏览器地址栏中添加参数，如: http://localhost:11017/?nocache=$(date +%s)"
echo "3. 使用浏览器开发工具检查网络请求，确认加载的样式文件是最新的"
echo "4. 如果页面显示403错误，检查容器内文件权限: docker exec -it ttsfm chmod -R 755 /app/static"
echo "5. 运行 ./clean_deploy.sh 脚本进行完全重新部署"
echo "6. 检查服务器日志以查找更多详细信息: docker logs ttsfm"
echo "" 