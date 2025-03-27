# 语音魔方网站部署故障排查

本文档提供了解决语音魔方网站常见部署问题的指南，特别是样式文件不更新和403权限问题。

## 常见问题1：通过Docker部署后样式未更新

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

## 常见问题2：403访问被拒绝错误

### 问题描述

网站部署后，访问某些资源时出现403错误（访问被拒绝），特别是在Docker容器部署环境中。这可能导致网站功能不正常或无法访问。

### 可能的原因

1. **容器内文件权限问题**：容器内的文件权限设置可能阻止Web服务器访问静态文件。
2. **Web服务器配置错误**：Nginx或Apache的配置可能限制了对某些资源的访问。
3. **用户/组权限不匹配**：容器内运行服务的用户可能与文件所有者不匹配。
4. **SELinux或AppArmor限制**：安全模块可能阻止了对特定文件的访问。
5. **Docker卷挂载权限**：如果使用卷挂载，主机与容器之间的权限映射可能有问题。

### 解决方案

#### 方案1：检查并修复容器内文件权限

```bash
# 进入容器
docker exec -it ttsfm /bin/bash

# 查看文件权限
ls -la /app/static/

# 修改文件权限
chmod -R 755 /app/static/
```

#### 方案2：确认Web服务器配置

```bash
# 检查Nginx配置
docker exec -it ttsfm cat /etc/nginx/conf.d/default.conf

# 检查Apache配置（如果使用Apache）
docker exec -it ttsfm cat /etc/apache2/sites-enabled/000-default.conf
```

常见的配置问题包括：
- 缺少正确的位置块（location block）
- 错误的访问控制设置
- 文件路径配置不正确

#### 方案3：重新构建容器并设置正确权限

使用提供的`clean_deploy.sh`脚本，它会处理权限问题：
```bash
./clean_deploy.sh [版本号]
```

#### 方案4：手动测试文件可访问性

```bash
# 检查网络服务是否正常运行
docker exec -it ttsfm ps aux | grep nginx

# 测试文件是否可以从容器内访问
docker exec -it ttsfm wget -O- http://localhost:7000/styles.css
```

## 新增功能：自动错误处理机制

为了提高网站的稳定性和用户体验，我们添加了自动错误处理机制。

### 错误处理脚本

我们在HTML中添加了`error-handler.js`脚本，该脚本可以：

1. **自动检测样式加载问题**：如果样式未正确加载，会引导用户到专门的错误页面，提供解决方案。
2. **监控403错误**：检测API访问权限问题，并显示友好的错误提示。
3. **提供详细日志**：在控制台中记录详细的错误信息，帮助诊断问题。

### 如何使用

该脚本已自动包含在网站的HTML文件中，无需手动添加。如果需要禁用，可以在HTML中注释掉相关脚本标签。

### 调试模式

在`error-handler.js`中，可以通过设置`CONFIG.debug = true`来启用详细日志记录：

```javascript
const CONFIG = {
    // 调试模式
    debug: true,
    // 其他配置...
};
```

### 错误页面

系统提供了以下错误页面：

- **样式错误页面**：当样式未正确加载时显示
  - 文件名：`styles-error-en.html`（支持中英文切换）
  
- **访问拒绝页面**：当遇到403错误时显示
  - 文件名：`access-denied-en.html`（支持中英文切换）

## 新的多语言架构

为了简化维护工作并提高用户体验，网站现在采用了单一HTML文件多语言架构。

### 主要特点

1. **单一HTML文件**：不再需要为每种语言维护单独的HTML文件，所有语言版本内容都在单一页面中
2. **本地存储语言设置**：用户的语言偏好会保存在浏览器本地存储中
3. **URL参数指定语言**：可以通过URL参数`lang=en`或`lang=zh`直接访问特定语言版本
4. **内联切换**：用户可以直接在页面上切换语言，而不需要加载新页面

### 如何维护多语言内容

要添加或修改翻译内容，只需在HTML文件中的`i18n`对象添加或更新对应语言的键值对：

```javascript
const i18n = {
    en: {
        "key": "English text",
        // 其他英文内容...
    },
    zh: {
        "key": "中文文本",
        // 其他中文内容...
    }
};
```

在HTML元素中使用`data-i18n`属性引用翻译键：

```html
<h1 data-i18n="key">默认显示内容</h1>
```

### 错误页的多语言支持

错误页面（如403错误页和样式错误页）也支持多语言，它们会：

1. 自动检测用户的语言偏好
2. 根据URL参数`lang`值切换语言
3. 允许用户在错误页上直接切换语言

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