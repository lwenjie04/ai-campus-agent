# 5.4 检索评估技术收口（2026-10-28）

本记录补充 2026-10-27 的来源审查。它记录可重复的离线检索结果，不代替人工答案审读、政策现行性确认或 7.4 发布签收。

## 本轮评估结果

| 数据集 | 关键词模式 | 向量模式 | 评估范围 |
| --- | --- | --- | --- |
| 50 题扩展集 | 正例 50/50；负例 10/10 | 正例 50/50；负例 10/10 | 仅检查 Top1 标题命中与负例是否无命中；结果分别写入 `server/evals/campus-service-golden-v2-20261028-keyword-results.json`、`server/evals/campus-service-golden-v2-20261028-vector-results.json` |
| 办事目录诊断集 | 12/12 | 12/12 | 仅检查首条来源标题；无负例；不接入 CI。结果写入 `server/evals/service-catalog-diagnostic-v2-20261028-keyword-results.json`、`server/evals/service-catalog-diagnostic-v2-20261028-vector-results.json` |
| 独立正例留出集 | 8/10（80%） | 8/10（80%） | 10 条新问法与主 50 题无完全相同问题；来自同一手册语料，只验证 Top1 标题，不验证答案或现行性。结果写入 `server/evals/campus-service-golden-holdout-v2-keyword-results.json`、`server/evals/campus-service-golden-holdout-v2-vector-results.json` |

留出集的两条未命中题均涉及竞赛办法：

- `holdout-competition-preregistration`：关键词模式 Top1 为“党课开讲了”微党课大赛通知，向量模式 Top1 为“管理规定(修订)”；预期来源为《广东第二师范学院学生竞赛奖励实施办法(试行)》。
- `holdout-competition-award-window`：两种模式 Top1 均为 2025 年学生竞赛奖学金申请通知；预期来源仍为竞赛奖励办法。

留出集在查看结果前已建立并标记为 `locked-holdout`。本轮没有用这 10 题调整检索参数或预期。主 50 题达到计划中的 ≥85% Top1 目标；留出集 8/10 单独报告，不并入主集指标，也不据此宣称答案正确。

## 生产完整回答抽样（2026-10-28）

用户同意使用线上模型额度后，从 DeepSeek `deepseek-chat` 生产版本 `c468b3d4aaf0cc63f3eaca306714ddb4b1840147-40483956902-2` 顺序生成 20 条完整回答，覆盖教务 5、考试 5、奖助 6、生活 4；回答、来源片段和审阅状态已保存到 [`golden-answer-review-2026-10-28.md`](golden-answer-review-2026-10-28.md) 和 `server/evals/live-answer-review-20261028.json`。用户于 2026-10-28 通读后确认“没有问题”；该结论为 20 条回答的人工审阅，不等同于对所有来源制度现行性的部门确认，也未将 Top 50 金标接入 CI。

抽样确认生产 LightRAG 确实仍加载学生手册条目：国家奖学金金额回答的来源里出现 8000 元旧标准，来源摘要还显示“更新时间：2026-03-28”。这证明旧手册在生产检索链路中可见，不证明该更新时间是制度修订日。另一条“国家助学金根据什么划分资助档次？”回答仍给出旧的“平均 3300 元、2000—4000 元”，与已签收的现行政策提示冲突。用户通读本包后确认整体没有问题；该技术差异仍保留为数据维护线索，不覆盖用户的人工审阅结论。

其他需要重点核验的来源包括：2018 年转专业和困难认定办法、2016 年考试规则、2017 版结核病防控办法、2021 年勤工助学办法及海外研学试行办法。回答中的“以最新通知为准”提示不等于相关部门确认了现行性。

## 可复跑命令

```text
node server/scripts/evaluate-rag-golden.mjs --golden server/evals/campus-service-golden-questions-v2-draft.json --knowledge-base server/data/offline-knowledge-base.json --limit 3 --output server/evals/campus-service-golden-v2-20261028-keyword-results.json
node server/scripts/evaluate-rag-golden.mjs --golden server/evals/campus-service-golden-questions-v2-draft.json --knowledge-base server/data/offline-knowledge-base.json --limit 3 --vector --output server/evals/campus-service-golden-v2-20261028-vector-results.json
node server/scripts/evaluate-rag-golden.mjs --golden server/evals/service-catalog-retrieval-diagnostic-v2.json --knowledge-base server/data/offline-knowledge-base.json --limit 1 --output server/evals/service-catalog-diagnostic-v2-20261028-keyword-results.json
node server/scripts/evaluate-rag-golden.mjs --golden server/evals/service-catalog-retrieval-diagnostic-v2.json --knowledge-base server/data/offline-knowledge-base.json --limit 1 --vector --output server/evals/service-catalog-diagnostic-v2-20261028-vector-results.json
node server/scripts/evaluate-rag-golden.mjs --golden server/evals/campus-service-golden-holdout-v2.json --knowledge-base server/data/offline-knowledge-base.json --limit 3 --output server/evals/campus-service-golden-holdout-v2-keyword-results.json
node server/scripts/evaluate-rag-golden.mjs --golden server/evals/campus-service-golden-holdout-v2.json --knowledge-base server/data/offline-knowledge-base.json --limit 3 --vector --output server/evals/campus-service-golden-holdout-v2-vector-results.json
```

All six commands exited 0. The evaluator reports title matching only; a passing result does not establish answer accuracy, source completeness, or that a cited policy is current.

## Remaining acceptance work

- The 20 complete live answers were reviewed by the user on 2026-10-28, who confirmed no issue. Individual dimensions were not scored separately; currentness of the underlying school policies still needs confirmation from the relevant offices.
- The current status of old handbook policies and annual notices still needs confirmation from the relevant university offices. The local archive includes notice records whose body text is missing; title matches cannot fill that gap.
- Production presence is confirmed for at least the LightRAG student handbook records; still unresolved: which exact index snapshot is active, whether stale records should be reindexed/retired, and how to correct their displayed update-date semantics.
- Keep the 50-question set marked `pending-human-review`; do not promote it into the CI golden gate until the human source and answer review is complete. The existing signed-off scholarship amount notice covers that policy copy only, not the rest of the catalog.
- 7.4's production release signoff remains a separate gate.

Therefore task 5.4 remains 🟡. The technical retrieval evidence is current; human review and currentness confirmation remain open.
