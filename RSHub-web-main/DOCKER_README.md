# RSHub Web Docker 部署指南

## 文件说明

### Dockerfile（开发环境）
- 基于Node.js 18 Alpine镜像构建
- 开发模式运行，支持热重载
- 避免静态站点生成问题

### Dockerfile.prod（生产环境）
- 多阶段构建，优化镜像大小
- 生产环境构建和部署
- 使用serve包提供静态文件服务

### docker-compose.yml
- 开发环境配置
- 支持代码热重载
- 配置端口映射和环境变量

### .dockerignore
- 排除不必要的文件，减小镜像大小
- 提高构建速度

## 使用方法

### 开发环境（推荐）

```bash
# 使用docker-compose启动开发环境
docker-compose up -d

# 查看容器状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 停止容器
docker-compose down
```

### 生产环境

```bash
# 使用生产版本Dockerfile构建
docker build -f Dockerfile.prod -t rshub-web-prod .

# 运行生产容器
docker run -d -p 3000:3000 --name rshub-web-prod rshub-web-prod

# 查看容器状态
docker ps

# 停止容器
docker stop rshub-web-prod
```

### 使用Docker命令（开发环境）

```bash
# 构建镜像
docker build -t rshub-web .

# 运行容器
docker run -d -p 3000:3000 -v $(pwd):/app --name rshub-web rshub-web

# 查看容器状态
docker ps

# 停止容器
docker stop rshub-web
```

## 访问应用

启动成功后，访问：http://localhost:3000

## 环境变量说明

### 开发环境
- `NODE_ENV=development` - 开发模式
- `CHOKIDAR_USEPOLLING=true` - 文件监听轮询
- `WATCHPACK_POLLING=true` - Webpack轮询

### 生产环境
- `NODE_ENV=production` - 生产模式
- `CI=true` - 持续集成模式

## 优势

1. **开发环境**：
   - 支持热重载，代码修改即时生效
   - 避免静态站点生成问题
   - 便于调试和开发

2. **生产环境**：
   - 多阶段构建，镜像体积小
   - 静态文件服务，性能优化
   - 适合部署到云服务器

3. **通用优势**：
   - 环境一致性
   - 快速部署
   - 版本控制
   - 资源隔离

## 注意事项

- 开发环境使用卷挂载，代码修改会即时生效
- 生产环境构建可能会遇到静态站点生成警告，但不影响运行
- 确保Docker和Docker Compose已安装
- 首次构建可能需要较长时间下载依赖

## 故障排除

### 构建失败
```bash
# 清理Docker缓存
docker system prune -f

# 重新构建
docker-compose up --build
```

### 端口冲突
修改docker-compose.yml中的端口映射：
```yaml
ports:
  - "8080:3000"  # 使用8080端口
```

### 权限问题
确保以管理员身份运行PowerShell或使用sudo（Linux/Mac） 