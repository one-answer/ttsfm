# 语音魔方网站部署故障排查

本文档提供了解决语音魔方网站常见部署问题的指南，特别是样式文件不更新的问题。

## 常见问题：通过Docker部署后样式未更新

### 问题描述

在本地环境中运行时网站样式正常，但通过Docker构建和部署后，网站显示的仍然是旧版本的样式。

### 可能的原因

1. **Docker构建缓存问题**：Docker可能使用缓存的层，不会拷贝最新的静态文件。
2. **容器内文件路径问题**：静态文件在容器内的路径可能与预期不符。
3. **浏览器缓存问题**：浏览器可能缓存了旧版本的CSS和JavaScript文件。
4. **服务器缓存设置**：服务器没有正确设置不缓存静态资源的头信息。
5. **文件权限问题**：容器内的文件可能没有正确的访问权限。

### 解决方案

#### 方案1：使用提供的脚本

我们提供了两个用于解决此问题的脚本：

1. **clean_deploy.sh** - 彻底清理并重新部署
   ```bash
   ./clean_deploy.sh [版本号]
   ```
   此脚本会执行以下操作：
   - 停止并删除现有容器
   - 删除Docker镜像
   - 清理Docker系统缓存
   - 清理静态文件缓存
   - 更新所有静态文件的版本标识符
   - 使用`--no-cache`参数重新构建Docker镜像
   - 部署新容器

2. **troubleshoot.sh** - 诊断问题
   ```bash
   ./troubleshoot.sh
   ```
   此脚本会帮助诊断问题：
   - 检查容器状态
   - 检查容器内的静态文件
   - 检查容器日志中的错误
   - 测试网站可访问性
   - 检查静态文件版本信息

#### 方案2：手动解决

如果提供的脚本无法解决问题，可以尝试以下手动步骤：

1. **清除Docker缓存**：
   ```bash
   docker system prune -a
   ```

2. **强制重建Docker镜像**：
   ```bash
   docker build --no-cache --pull . -t aolifu/ttsfm:v2
   ```

3. **检查容器内的文件**：
   ```bash
   # 启动容器
   docker run -d --name ttsfm -p 11017:7000 aolifu/ttsfm:v2
   
   # 查看容器内的静态文件
   docker exec -it ttsfm ls -la /app/static/
   
   # 查看容器日志
   docker logs ttsfm
   ```

4. **检查文件路径**：
   确保服务器代码中的文件路径处理逻辑与Docker容器内的实际路径一致。

#### 方案3：客户端解决

如果服务器端已经更新但客户端仍然看到旧样式：

1. **强制刷新浏览器**：
   - Windows: `Ctrl + F5`
   - Mac: `Cmd + Shift + R`

2. **清除浏览器缓存**：
   - Chrome: 打开开发者工具，右键刷新按钮，选择"清空缓存并硬重新加载"
   - Firefox: `Ctrl + Shift + Delete`，勾选"缓存"，然后点击"立即清除"

3. **使用隐身/无痕模式**：
   在隐身模式下打开网站，它不会使用已缓存的文件。

4. **添加URL参数**：
   在URL末尾添加随机参数，如：`http://localhost:11017/?nocache=123456`

## 预防措施

为避免将来出现此类问题，建议采取以下预防措施：

1. **在HTML中使用版本参数**：
   ```html
   <link rel="stylesheet" href="styles.css?v=1.2.3">
   <script src="script.js?v=1.2.3"></script>
   ```

2. **设置正确的缓存控制头**：
   ```
   Cache-Control: no-cache, no-store, must-revalidate
   Pragma: no-cache
   Expires: 0
   ```

3. **使用内容哈希**：
   可以考虑使用文件内容的哈希值作为文件名的一部分，确保内容变化时文件名也会变化。

4. **定期清理Docker缓存**：
   ```bash
   docker system prune
   ```

## 故障排查工具

### 网络请求分析

使用浏览器开发者工具的网络面板检查：

1. 静态资源是否正确加载
2. 响应状态码是否为200
3. 资源内容是否为预期的新版本
4. 响应头中的缓存控制设置

### 容器内文件检查

```bash
# 进入容器内部
docker exec -it ttsfm /bin/bash

# 查看静态文件
ls -la /app/static/

# 检查文件内容
cat /app/static/styles.css | head -n 10
```

如果问题仍然存在，请联系技术支持团队获取进一步帮助。 