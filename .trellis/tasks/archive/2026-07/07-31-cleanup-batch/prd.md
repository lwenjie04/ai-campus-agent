# PRD: 小任务批量（KB 失效 downloadPath + mobile-uniapp 重复目录 + pm2 配置）

## 背景

三个独立的小清理/配置项，均为迁移/历史遗留问题：
1. `server/data/knowledge-base.json` 有 4 条 `downloadPath` 指向历史上已删除的附件（下载必 404）。
2. `mobile-uniapp/` 存在两份页面结构：根 `pages/ api/ stores/ types/ utils/ App.vue main.ts pages.json env.d.ts` 与 `src/` 下同名文件内容不同；`vite.config.ts` 别名 `@: '/src'` 表明 **src/ 是 uni Vite 构建输入**，根目录副本未被使用。
3. 部署清单是手写步骤，缺少可重复的 pm2 启动配置。

## 目标

1. **KB 清理**：移除 `knowledge-base.json` 中 `downloadPath` 指向不存在文件的条目字段（`downloadPath`/`downloadName`），使下载接口不再引用坏路径。
2. **mobile-uniapp 整理**：删除根目录的重复副本（`pages/ api/ stores/ types/ utils/ App.vue main.ts pages.json env.d.ts`），保留 `src/` 版本与根目录构建必需文件（`manifest.json index.html vite.config.ts package.json tsconfig.json uni.scss main.js`）。
3. **pm2 配置**：新增根 `ecosystem.config.js`，固化后端启动（cwd=server，node index.mjs），并加根 npm 脚本。

## 验收标准

1. KB：脚本执行后 `knowledge-base.json` 无指向不存在文件的 `downloadPath`；JSON 合法；其余数据不变。
2. mobile-uniapp：删除后根目录不再有与 `src/` 重复的页面/api/store 目录；保留文件清单符合目标；`src/` 完整无损。
3. pm2：`ecosystem.config.js` 合法；`pm2 start ecosystem.config.js` 的配置指向 `server/index.mjs`（本机无 pm2 则仅校验配置结构）；根 package.json 有 `pm2:start` 脚本。
4. 提交推送至 `chore/cleanup-batch` 分支。
