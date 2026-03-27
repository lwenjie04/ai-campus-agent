# 学生社区功能 V1 开发基线文档

## 1. 文档目的

本文档用于沉淀“学生社区”功能第一版的需求范围、数据分层原则、前后端接口、核心字段和分阶段开发计划。

后续开发默认以本文档为准，新的讨论结果需要持续更新到本文档中。

---

## 2. 功能定位

学生社区功能不是简单新增一个“论坛页”，而是要在现有校园问答系统中形成两层能力：

1. 社区互动层
   - 学生发帖
   - 学生回复
   - 按分类浏览帖子
   - 搜索帖子

2. 知识沉淀层
   - 将高质量社区内容转为“社区知识条目”
   - 社区知识作为低可信度辅助来源参与 RAG
   - 官方知识库仍然优先于社区知识库

---

## 3. 设计原则

### 3.1 官方知识与社区知识分层

- 官方知识来源：
  - 学校官网通知
  - 教务系统相关正式资料
  - 奖学金附件与正式制度文件
- 社区知识来源：
  - 学生帖子
  - 学生回复
  - 经审核提炼后的社区经验总结

结论：
- 社区内容不能直接进入主知识库
- 社区内容必须经过审核、摘要化、打标签后，才能作为辅助知识来源参与检索

### 3.2 社区内容默认低可信度

社区来源必须在前端 sources 区明确标识为：

- `学生经验`
- `社区讨论`
- `仅供参考，请以学校官方通知为准`

### 3.3 第一版先做轻社区

第一版只做：

- 帖子列表
- 帖子详情
- 发帖
- 回复
- 审核
- 社区知识沉淀

第一版不做：

- 私信
- 关注
- 图片/视频上传
- 多级评论
- 推荐流
- 实时通知

### 3.4 社区业务数据优先使用 MySQL

原因：

- 社区功能是高频增删改查场景
- JSON 不适合持续写入和复杂查询
- 后续审核、统计、知识沉淀都更适合结构化存储

结论：

- 业务数据：MySQL
- 当前官方知识库：保留 JSON
- 后续社区知识可先存 MySQL，再由检索层读取

---

## 4. 第一版目标

第一版的最小可用目标是：

1. 学生可以查看社区帖子列表
2. 学生可以发布帖子
3. 学生可以查看帖子详情并回复
4. 管理员可以审核帖子和回复
5. 审核通过的优质内容可以沉淀为社区知识条目
6. 社区知识可以作为 RAG 的辅助来源返回给前端

---

## 5. 前端模块规划

### 5.1 新增页面

- `src/views/CommunityView.vue`
  - 学生社区首页
  - 展示帖子列表
  - 支持搜索、分类筛选、发帖入口

- `src/views/PostDetailView.vue`
  - 帖子详情页
  - 展示主帖、回复列表、回复输入区

### 5.2 新增组件

- `src/components/community/PostList.vue`
- `src/components/community/PostCard.vue`
- `src/components/community/CommunityToolbar.vue`
- `src/components/community/PostEditorDialog.vue`
- `src/components/community/PostDetail.vue`
- `src/components/community/ReplyList.vue`
- `src/components/community/ReplyItem.vue`
- `src/components/community/ReplyEditor.vue`

### 5.3 新增状态管理

- `src/store/community.ts`

建议状态：

- 帖子列表
- 当前帖子详情
- 当前帖子的回复列表
- 搜索关键词
- 分类筛选值
- 分页状态
- loading 状态

### 5.4 新增前端 API 封装

- `src/api/community.ts`

建议封装方法：

- `getCommunityMeta`
- `getCommunityPosts`
- `getCommunityPostDetail`
- `createCommunityPost`
- `createCommunityReply`
- `getPendingPosts`
- `getPendingReplies`
- `approvePost`
- `rejectPost`
- `approveReply`
- `rejectReply`
- `generateCommunityKnowledge`

---

## 6. 后端模块规划

### 6.1 推荐新增文件

- `server/community.mjs`
  - 社区基础接口
  - 审核接口
  - 社区知识生成接口

- `server/community-rag.mjs`
  - 社区知识检索逻辑
  - 与主知识库检索结果融合

- `server/mysql.mjs` 或 `server/db.mjs`
  - 数据库连接与查询封装

### 6.2 与现有后端关系

现有文件：

- `server/index.mjs`
- `server/rag.mjs`
- `server/sources-rules.mjs`

建议：

- `server/index.mjs` 继续做统一路由入口
- 将社区相关逻辑拆到独立文件，避免入口文件继续膨胀

---

## 7. 数据对象定义

### 7.1 帖子对象 `CommunityPost`

```ts
type CommunityPost = {
  id: string
  authorName: string
  authorRole?: 'student' | 'teacher'
  title: string
  content: string
  category: string
  tags: string[]
  status: 'pending' | 'approved' | 'rejected'
  replyCount: number
  likeCount: number
  viewCount: number
  createdAt: string
  updatedAt: string
}
```

### 7.2 回复对象 `CommunityReply`

```ts
type CommunityReply = {
  id: string
  postId: string
  authorName: string
  authorRole?: 'student' | 'teacher'
  content: string
  status: 'pending' | 'approved' | 'rejected'
  likeCount: number
  createdAt: string
}
```

### 7.3 社区知识对象 `CommunityKnowledge`

```ts
type CommunityKnowledge = {
  id: string
  postId: string
  title: string
  summary: string
  content: string
  category: string
  keywords: string[]
  confidence: number
  status: 'pending' | 'approved' | 'rejected'
  sourceType: 'community_summary'
  createdAt: string
  updatedAt: string
}
```

---

## 8. MySQL 表结构规划

### 8.1 帖子表 `community_posts`

建议字段：

- `id`
- `author_name`
- `author_role`
- `title`
- `content`
- `category`
- `tags`
- `status`
- `reply_count`
- `like_count`
- `view_count`
- `created_at`
- `updated_at`

### 8.2 回复表 `community_replies`

建议字段：

- `id`
- `post_id`
- `author_name`
- `author_role`
- `content`
- `status`
- `like_count`
- `created_at`

### 8.3 社区知识表 `community_knowledge`

建议字段：

- `id`
- `post_id`
- `title`
- `summary`
- `content`
- `category`
- `keywords`
- `confidence`
- `status`
- `source_type`
- `created_at`
- `updated_at`

### 8.4 审核日志表 `community_review_logs`

建议字段：

- `id`
- `target_type`
- `target_id`
- `action`
- `reviewer`
- `note`
- `created_at`

---

## 9. 接口设计原则

### 9.1 返回结构统一

成功：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

失败：

```json
{
  "code": 4001,
  "message": "参数错误",
  "data": null
}
```

### 9.2 第一版鉴权策略

第一版暂不强依赖完整登录体系，可先使用：

- 昵称
- 角色字段
- 管理员固定能力

后续再接真实登录。

---

## 10. 社区基础接口设计

### 10.1 获取帖子列表

**接口**

`GET /community/posts`

**查询参数**

```ts
{
  page?: number
  pageSize?: number
  category?: string
  keyword?: string
  status?: 'approved'
  sortBy?: 'latest' | 'hot'
}
```

**返回示例**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "id": "post_001",
        "authorName": "张同学",
        "title": "转专业后课程补退选怎么操作？",
        "content": "我想问一下转专业之后课程补退选具体流程是什么？",
        "category": "teaching",
        "tags": ["转专业", "补退选"],
        "status": "approved",
        "replyCount": 3,
        "likeCount": 8,
        "viewCount": 102,
        "createdAt": "2026-03-24T09:00:00.000Z",
        "updatedAt": "2026-03-24T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "total": 36
    }
  }
}
```

### 10.2 获取帖子详情

**接口**

`GET /community/posts/:id`

**返回示例**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "post": {
      "id": "post_001",
      "authorName": "张同学",
      "title": "转专业后课程补退选怎么操作？",
      "content": "我想问一下转专业之后课程补退选具体流程是什么？",
      "category": "teaching",
      "tags": ["转专业", "补退选"],
      "status": "approved",
      "replyCount": 3,
      "likeCount": 8,
      "viewCount": 102,
      "createdAt": "2026-03-24T09:00:00.000Z",
      "updatedAt": "2026-03-24T10:30:00.000Z"
    },
    "replies": [
      {
        "id": "reply_001",
        "postId": "post_001",
        "authorName": "李同学",
        "content": "我去年是先看教务通知，再联系学院确认课程。",
        "status": "approved",
        "likeCount": 2,
        "createdAt": "2026-03-24T10:00:00.000Z"
      }
    ]
  }
}
```

### 10.3 发布帖子

**接口**

`POST /community/posts`

**请求体**

```json
{
  "authorName": "张同学",
  "authorRole": "student",
  "title": "转专业后课程补退选怎么操作？",
  "content": "我想问一下转专业之后课程补退选具体流程是什么？",
  "category": "teaching",
  "tags": ["转专业", "补退选"]
}
```

**返回示例**

```json
{
  "code": 0,
  "message": "发布成功",
  "data": {
    "id": "post_001",
    "status": "pending"
  }
}
```

### 10.4 回复帖子

**接口**

`POST /community/posts/:id/replies`

**请求体**

```json
{
  "authorName": "李同学",
  "authorRole": "student",
  "content": "我去年是先联系学院，再按教务系统里的时间进行补退选。"
}
```

**返回示例**

```json
{
  "code": 0,
  "message": "回复成功",
  "data": {
    "id": "reply_001",
    "status": "pending"
  }
}
```

### 10.5 获取分类与标签元信息

**接口**

`GET /community/meta`

**返回示例**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "categories": [
      { "label": "奖学金", "value": "scholarship" },
      { "label": "教务", "value": "teaching" },
      { "label": "考试", "value": "exam" },
      { "label": "生活服务", "value": "life" },
      { "label": "其他", "value": "general" }
    ],
    "hotTags": ["转专业", "奖学金", "补退选", "宿舍", "交通车"]
  }
}
```

---

## 11. 审核接口设计

### 11.1 获取待审核帖子

**接口**

`GET /community/review/posts`

**查询参数**

```ts
{
  page?: number
  pageSize?: number
  status?: 'pending'
}
```

### 11.2 获取待审核回复

**接口**

`GET /community/review/replies`

### 11.3 审核通过帖子

**接口**

`POST /community/review/posts/:id/approve`

**请求体**

```json
{
  "reviewer": "admin",
  "note": "内容可见，允许发布"
}
```

### 11.4 审核拒绝帖子

**接口**

`POST /community/review/posts/:id/reject`

**请求体**

```json
{
  "reviewer": "admin",
  "note": "内容不符合社区规范"
}
```

### 11.5 审核通过回复

**接口**

`POST /community/review/replies/:id/approve`

### 11.6 审核拒绝回复

**接口**

`POST /community/review/replies/:id/reject`

---

## 12. 社区知识沉淀接口

### 12.1 从帖子生成社区知识条目

**接口**

`POST /community/knowledge/generate`

**请求体**

```json
{
  "postId": "post_001"
}
```

**返回示例**

```json
{
  "code": 0,
  "message": "生成成功",
  "data": {
    "knowledgeId": "ck_001",
    "status": "pending",
    "summary": "根据学生社区讨论，转专业后课程补退选通常需要先确认学院安排，再按教务通知时间办理。"
  }
}
```

### 12.2 获取社区知识条目列表

**接口**

`GET /community/knowledge`

**查询参数**

```ts
{
  page?: number
  pageSize?: number
  status?: 'approved' | 'pending'
  category?: string
}
```

### 12.3 审核通过社区知识条目

**接口**

`POST /community/knowledge/:id/approve`

### 12.4 拒绝社区知识条目

**接口**

`POST /community/knowledge/:id/reject`

---

## 13. RAG 融合策略

### 13.1 知识源优先级

检索时默认优先级：

1. 官方来源
   - 官网通知
   - 教务资料
   - 奖学金附件

2. 社区来源
   - 社区知识摘要
   - 学生经验总结

### 13.2 RAG 融合建议

1. 先检索官方知识库
2. 官方命中不足时，再补社区知识条目
3. 社区知识默认低权重
4. 前端来源展示要明确区分类型和可信度

### 13.3 sources 返回结构示例

```json
[
  {
    "type": "official_notice",
    "confidence": 0.9,
    "title": "关于转专业学生办理2025-2026学年课程补退选和成绩认定的通知",
    "url": "https://www.gdei.edu.cn/xxx",
    "snippet": "根据教务通知，转专业学生需在规定时间内完成补退选和成绩认定。",
    "attachments": []
  },
  {
    "type": "community_summary",
    "confidence": 0.45,
    "title": "学生社区经验总结：转专业补退选办理流程",
    "url": "/community/posts/post_001",
    "snippet": "来自学生社区的经验总结，仅供参考，请以学校官方通知为准。",
    "attachments": []
  }
]
```

### 13.4 前端展示要求

当来源类型是社区来源时，前端必须明确展示：

- 来源类型：`学生经验`
- 可信度：低于官方来源
- 风险提示：`仅供参考，请以学校官方通知为准`

---

## 14. 第一版最小可用接口集

第一版优先实现以下 8 个接口：

### 前台接口

1. `GET /community/meta`
2. `GET /community/posts`
3. `GET /community/posts/:id`
4. `POST /community/posts`
5. `POST /community/posts/:id/replies`

### 审核接口

6. `GET /community/review/posts`
7. `POST /community/review/posts/:id/approve`
8. `POST /community/review/posts/:id/reject`

---

## 15. 推荐开发顺序

### 阶段 1：社区基础页面

先完成：

- 社区入口
- 社区列表页
- 帖子详情页
- 发帖
- 回复

### 阶段 2：后端接口 + MySQL

再完成：

- 帖子表
- 回复表
- 列表查询
- 发帖接口
- 回复接口

### 阶段 3：审核机制

再补：

- 状态字段
- 待审核查询
- 通过/拒绝

### 阶段 4：社区知识沉淀

再做：

- 生成社区知识摘要
- 审核知识条目
- 社区知识入检索层

### 阶段 5：RAG 融合

最后完成：

- 检索官方知识 + 社区知识
- sources 分级展示
- 社区来源风险提示

---

## 16. 第一版暂不做事项

第一版明确不做以下内容：

- 私信
- 关注作者
- 图片上传
- 视频上传
- 多级嵌套评论
- 推荐算法
- 实时通知
- 社区原帖直接进入主知识库

---

## 17. 当前版本建议的下一步

基于本文档，后续建议开发顺序为：

1. 先完成 MySQL 建表 SQL
2. 再完成后端接口骨架
3. 再完成前端社区页面骨架
4. 最后接入审核与社区知识沉淀

---

## 18. 文档维护约定

后续如果有以下变更，必须同步更新本文档：

- 接口路径变化
- 字段命名变化
- 状态值变化
- 社区内容入库规则变化
- RAG 融合策略变化

本文档是学生社区功能第一版的开发基线文档。
