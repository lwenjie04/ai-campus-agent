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

- A human must review at least 20 complete generated answers for conditions, required materials, dates, source consistency, and historical-versus-current policy framing. Existing saved real-model checks cover selected examples, not 20 answers.
- The current status of old handbook policies and annual notices still needs confirmation from the relevant university offices. The local archive includes notice records whose body text is missing; title matches cannot fill that gap.
- Production's exact knowledge-base snapshot and whether it includes the old handbook records have not been confirmed in this review.
- Keep the 50-question set marked `pending-human-review`; do not promote it into the CI golden gate until the human source and answer review is complete. The existing signed-off scholarship amount notice covers that policy copy only, not the rest of the catalog.
- 7.4's production release signoff remains a separate gate.

Therefore task 5.4 remains 🟡. The technical retrieval evidence is current; human review and currentness confirmation remain open.
