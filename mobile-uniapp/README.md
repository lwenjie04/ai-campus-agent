# mobile-uniapp

这是校园智能问答系统的移动端子项目骨架，基于 `uni-app + Vue3 + TypeScript` 规划。

## 当前目标

- 搭建独立移动端目录，不影响现有桌面端与后端
- 先沉淀页面结构、接口封装和基础配置
- 第一版优先覆盖：
  - 首页问答
  - 学生社区列表
  - 帖子详情
  - 用户信息设置

## 目录说明

- `src/App.vue`：移动端全局壳子
- `src/pages.json`：页面路由配置
- `src/pages/index/index.vue`：首页问答
- `src/pages/community/index.vue`：学生社区列表
- `src/pages/community/detail.vue`：帖子详情
- `src/pages/profile/index.vue`：用户信息设置
- `src/api/`：后端接口封装
- `src/utils/`：配置与通用工具

## 后续启动建议

后面真正开始开发时，在 `mobile-uniapp/` 目录执行：

```powershell
npm install
npm run dev:h5
```

## 环境变量

默认通过 `src/utils/config.ts` 指向本地后端：

- `http://localhost:3000`

后续如果要切小程序或真机环境，可以再拆成：

- 开发环境
- 测试环境
- 生产环境
