# 浏览器登录态导出通知（半自动）

适用场景：
- 官网通知详情页需要登录态（`ticket=...`）
- 你可以正常在浏览器里打开页面，但不适合做爬虫

## 使用方法

1. 打开通知详情页（已登录状态）
2. 按 `F12` 打开开发者工具
3. 切到 `Console`
4. 打开 `server/scripts/browser-export-notice.console.js`
5. 全选复制脚本内容，粘贴到控制台执行

执行后会：
- 自动下载一个 `*.json` 文件（通知标题命名）
- 控制台打印导出结果（标题、时间、正文、附件链接）

## 导出结果结构（示例）

```json
{
  "schemaVersion": 1,
  "source": {
    "site": "https://www.gdei.edu.cn",
    "pageUrl": "https://...",
    "pageTitle": "...",
    "exportedAt": "2026-02-25T..."
  },
  "notice": {
    "title": "关于……的通知",
    "publishedAt": "2026-02-25",
    "content": "正文文本……",
    "attachments": [
      {
        "name": "附件1：XXX.pdf",
        "url": "https://..."
      }
    ]
  }
}
```

## 建议流程

1. 用浏览器登录官网并打开通知详情页
2. 用本脚本导出 JSON
3. 把 JSON 放到 `src/project-text/exports/`（或你自己的目录）
4. 再用本地批量入库脚本做下一步整理

## 注意事项

- `ticket=...` 链接有时效性，导出的附件链接后续可能失效
- 建议同时手动下载重要附件/PDF，作为长期可用的本地文件
- 不同栏目页面结构不同，若某页正文提取不完整，可以把该页 HTML 截图或导出结果发给我，我帮你调规则

