# 5.4 金标来源核对记录

核对日期：2026-10-27。范围为 Top 20 基础题、Top 50 扩展草案和 10 条负例；本记录不构成人工签收，也不证明未逐条列出的来源已经现行。

## 已核实的情况

| 事项 | 证据与结论 | 处理 |
| --- | --- | --- |
| 2024—2025 学年国家奖学金金额 | 仓库内[学校评审通知 PDF](<../_ingest/transfer_major/关于做好2024-2025学年国家奖学金和国家励志奖学金评审工作的通知及附件/关于做好2024-2025学年国家奖学金和国家励志奖学金评审工作的通知.pdf>)第 3 页载明，国家奖学金每人每年 10000 元、国家励志奖学金每人每年 6000 元。与[财政部、教育部等 2024 年通知](https://hudong.moe.gov.cn/jyb_xxgk/moe_1777/moe_1779/202410/t20241029_1159726.html)一致。 | `scholarship-national-award-amounts` 可依据该 PDF 作为限定 2024—2025 学年的历史题；2026—2027 学年校内申请流程仍需该学年通知。 |
| 手册中的旧金额 | 2025 学生手册中《国家奖助学金实施办法》仍记载 8000/5000 元；《学生资助工作实施办法》也记载国家奖学金 8000 元。2024 年国家通知规定，本专科国家奖学金和国家励志奖学金分别调整为 10000/6000 元，与通知不一致的旧规定按新通知执行。 | 旧金额只能作为历史条文。合并离线库实测“现在国家奖助学金实施办法标准是多少？”时，旧金额制度出现在 Top 1 和 Top 2；需修复来源时效和冲突处理。默认运行库与离线评估合并库不同，本次没有证明线上实际返回了错误答案。 |
| 迟到半小时考试题 | 手册《学生考试规则》第五条写明迟到超过半小时不得进入试室；《学生考试违规处分规定》正文没有相应迟到时限。 | `exam-late-entry` 已移除后者这一不支持答案的备选标题；考试规则是否仍现行待学校确认。 |
| 困难生认定 | [广东省 2023 年家庭经济困难学生认定办法](https://www.gdwc.gov.cn/downpc/bmdh/jyj/zwgk/tzgg/content/post_1786473.html)对高校认定程序作出规定。学校手册中的试行办法可核对其历史条文，但不能单凭手册判断当前校内流程。 | `scholarship-financial-difficulty` 及相关认定题需核对学校现行办法和当前学年通知。 |
| 转专业与请假 | 2025 手册收录 2018 年修订的转专业规定和 2016 年起实施的考勤、请假规定。[2026 年招生章程](https://gaokao.chsi.com.cn/zsgs/zhangcheng/listVerifedZszc--method-view%2CschId-486612%2CinfoId-7683178763.dhtml)对部分招生类型的转专业设有约束，不能据此判定 2018 年全文仍然现行。 | 须取得教务部门最新转专业文件及学生部门现行请假审批规则；未确认前不将旧条文当作当前办理规则。 |
| 图书馆借阅 | 手册中的《文献资源借阅管理规定》确有借书数量和期限条款；没有找到可确认当前馆规的本校正式网页。 | `life-library-borrowing-limit` 只确认手册原文存在；当前数量和期限需图书馆核实。 |

## 题目与语料的缺口

以下题目的对应通知在合并离线知识库中只有标题、发布者、日期或附件名，未包含题目所问的具体正文。评估器命中这些标题仍会记为通过；需补充和核对原文，或调整问题与预期结果：

- `teaching-elective-registration`、`exam-cet-registration`、`exam-cet-arrangements`、`exam-discipline`、`exam-makeup-results`、`exam-final-inspection`；
- `scholarship-grant-review`、`scholarship-competition`、`life-qingming`。

`teaching-public-elective-guide` 的条目有附件线索，但没有指南正文；`life-dorm-change` 的首条结果主要是附件名，另有手册可提供部分一般规定。转专业、学业预警、困难认定等题也存在正文不足的年度通知与手册全文并列，应分别核对，不能只按标题判定可回答。

以下问题没有限定学年或学期，而预期通知来自特定旧年度：`teaching-elective-registration`、`teaching-public-elective-guide`、`exam-makeup-results`、`exam-final-inspection`、`exam-discipline`、`scholarship-national-inspirational`、`scholarship-grant-review`、`scholarship-competition`、`life-dorm-change`、`life-shuttle`。应明确改为历史问题或取得当前年度文件后重建预期。

2026 年上半年四六级、2025 年 12 月四六级、2026 年寒假和清明、2024—2025 学年奖学金等明确限定日期的问题可作为历史检索题，不能用于证明当前流程可回答。负例 `negative-future-cet` 的 2027 年报名日期应绑定知识库快照并设置复核条件：相关通知发布并入库后，它可能不再是无命中题。

## 评估与日期边界

- `server/rag-golden-evaluator.mjs` 的正例只比较首条结果标题，负例只判断是否无结果；它不检查正文、回答正确性或来源时效。Top 20 中部分问题在 `c8e3979` 已为现有语料改写，当前 50/50 是该草案上的回代结果，不是独立问题集的泛化准确率。
- 扩展草案 30 个正例和 10 个负例仍标记 `pending-human-review`；基础 20 题没有统一的逐题复核状态。当前记录只确认上文列明的事实，尚不能代替全部题目的人工签收。
- `server/scripts/import-student-handbook-docx.mjs` 将 DOCX 文件的本地修改时间写入每条制度的 `updatedAt`；当前本地手册条目显示 `2026-10-22`。该日期不证明制度在那天修订。`server/rag.mjs` 会使用 `updatedAt` 做时间衰减，并将其交给模型和来源接口，因此加载该手册数据的环境需修正此字段含义。线上是否加载该手册数据尚需单独确认。

## 本次验证与剩余事项

- 对 `server/evals/campus-service-golden-questions-v2-draft.json` 和 `server/data/offline-knowledge-base.json` 执行 `node server/scripts/evaluate-rag-golden.mjs --golden server/evals/campus-service-golden-questions-v2-draft.json --knowledge-base server/data/offline-knowledge-base.json --limit 3`，分别加和不加 `--vector`：均为正例 50/50、负例 10/10；这是标题命中与空结果指标。
- `node server/tests/rag-golden-evaluator.test.mjs`：4/4 通过。迟到题在两种评估中均命中《学生考试规则》。
- 继续补齐通知正文、修正来源时效和更新时间语义，逐题审核问题与答案依据、建立独立问题集，并由学校相关部门确认仍有疑问的现行制度。完成前 5.4 保持 🟡，Top 50 不作为已签收金标接入 7.3。

## Lead 接手补充（2026-10-27）

AI-2（Codex）额度中断后，由 AI-1（Lead）接手 5.4 的未提交改动，验证并收口如下。

### 时间语义与检索上下文

- `server/scripts/import-student-handbook-docx.mjs` 不再把 DOCX 本地文件修改时间写入 `updatedAt`；重建离线库后 33 条手册来源该项为空，避免把导入日期当成制度修订日期，也避免时间衰减因此高估旧制度的新鲜度。
- `server/rag.mjs`、`server/lightrag.mjs`、`server/scripts/import-kb-to-lightrag.mjs` 的回答上下文补充来源标注、适用时期、发布日期、现行状态，并明确：旧年度通知只作历史参考、只有标题/附件线索不得推断正文结论、来源冲突时要说明不确定性。
- 新增 `server/tests/rag-currentness.test.mjs`（3 条）：`npm run test:server` 67/67、`npm run server:check` 80 模块通过。

### 目录诊断集与结果（非金标）

新增 `server/evals/service-catalog-retrieval-diagnostic-v2.json`：12 个已人工确认事项各 1 问，仅检查首条标题是否匹配事项参考标题，不验证正文、答案正确性或制度现行性，不接入 CI。

| 模式 | 正例 | 负例 | 结论 |
| --- | --- | --- | --- |
| 离线关键词 | 9/12（75%） | 0 条（未设负例） | 未达 90% 目标，仅作诊断 |
| 离线向量 | 9/12（75%） | 0 条（未设负例） | 与关键词一致 |

结果文件：`server/evals/service-catalog-retrieval-diagnostic-v2-keyword-results.json`、`server/evals/service-catalog-retrieval-diagnostic-v2-vector-results.json`。

失败 3 题（两种模式相同）：

- `teaching-transfer-major`：Top1 是手册《普通本科生转专业管理规定(2018年修订)》（无日期、内容覆盖广），2025 年转专业通知排第 3；无日期旧制度不受时间衰减影响，需人工决定旧制度与学年通知的优先级或引入时效排序。
- `exam-retake`：Top1 是手册《成绩管理办法》38 分，2026-03 补考通知 36.75 分排第 2；最新通知未胜出，排序差距需要处理。
- `life-dorm-adjustment`：Top1 是无关的个税汇算提示（5 分）；期望的宿舍调宿通知在库中，但长句查询未召回（“调宿”等 2 字领域词不在领域词表、长句 n-gram 与标题不匹配），需补领域词或改进中文查询切分。

### 回归与未完成

- 回归：Top 20 关键词/向量均 20/20；Top 50 草案关键词/向量均 50/50、负例 10/10；`rag-golden-evaluator` 4/4；`npm run test:server` 67/67。
- 未完成：手册旧金额（8000/5000）与 2024 年国家政策（10000/6000）的冲突仍未在检索层消解，只在回答上下文加了冲突规则；诊断/金标中多条通知正文仍缺失、多题未限定学年；检索排序与中文查询切分本轮未调整（避免为 12 题诊断过拟合，应作为独立检索任务并跑金标回归）；逐题核验、独立问题集与人工签收仍未完成，5.4 保持 🟡。
