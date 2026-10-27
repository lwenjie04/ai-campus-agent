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
| 离线关键词 | 12/12（100%） | 0 条（未设负例） | 达到 90% 阈值，仍仅作诊断 |
| 离线向量 | 12/12（100%） | 0 条（未设负例） | 与关键词一致 |

结果文件：`server/evals/service-catalog-retrieval-diagnostic-v2-keyword-results.json`、`server/evals/service-catalog-retrieval-diagnostic-v2-vector-results.json`。

第一轮接手验证时为 9/12；第二轮检索调整（见下）修复 `exam-retake`、`life-dorm-adjustment`，达到 11/12。`teaching-transfer-major` 的期望经用户 2026-10-27 确认：本学年通知尚未发布，接受「2018 年手册规定」或「2025 年旧通知」任一 Top1（`1b9afbf`），并要求回答提示当前学年安排无法确认；修正后诊断 12/12（仍为非金标，只验证首条标题命中）。

### 回归与未完成

- 回归：Top 20 关键词/向量均 20/20；Top 50 草案关键词/向量均 50/50、负例 10/10；`rag-golden-evaluator` 4/4；`npm run test:server` 67/67。
- 未完成：手册旧金额（8000/5000）已由第三轮“现行政策提示”处理（见文末，`9f19d6c`），但提示数据仍待人工签收确认上线；诊断/金标中多条通知正文仍缺失、多题未限定学年；逐题核验、独立问题集与人工签收仍未完成，5.4 保持 🟡。

### 检索排序调整（第二轮，`5ecb8c4`）

- 问题：长句查询里的 2 字领域词（调宿/补考等）不会进入 3 字以上 n-gram；当查询其余部分是长句时，正确事项标题只靠 2 字词命中，容易被无关长 n-gram（如“办理时间”）结果压过。
- 改动：
  - `DOMAIN_KEYWORDS` 补充 2 字领域词：调宿、复学、床位、报修、挂失、借阅、补办、缴费、请假、考勤、学生证、校园卡、缓交、减免。
  - `scoreEntry` 对“2 字领域词命中标题”增加 `RAG_WEIGHT_DOMAIN_TITLE_BOOST`（默认 7，可用环境变量覆盖），保留原有标题基础分；只在领域词命中标题时生效。
- 结果：12 题诊断 9/12 → **11/12（关键词与向量一致）**；`exam-retake`、`life-dorm-adjustment` 修复。
- 回归：Top 20 关键词/向量 20/20；Top 50 草案关键词/向量 50/50、负例 10/10；新增 `server/tests/rag-long-query-recall.test.mjs` 2 条；`npm run test:server` 69/69；`npm run server:check` PASS 81 模块；定向 ESLint/oxlint 0 error、`git diff --check` 通过。
- 仍未完成：`teaching-transfer-major` 的期望需人工复核；手册旧金额冲突、通知正文缺失与年度限定、逐题核验与人工签收仍未解决，5.4 保持 🟡。

### 转专业题期望确认（`1b9afbf`）

- 用户 2026-10-27 确认：本学年转专业通知尚未发布，`teaching-transfer-major` 接受《广东第二师范学院普通本科生转专业管理规定》或《关于2025年普通本科生转专业工作的通知》任一 Top1；回答必须提示当前学年安排无法确认。
- 诊断集只改期望与备注，不调排序；修正后 12/12（关键词/向量一致）。

### 现行政策提示（第三轮，`9f19d6c`）

- 决策：用户 2026-10-27 选择“新增现行政策提示数据”方案，不改手册原文。
- 数据：`server/data/policy-updates.json`（`status: signed-off`，用户 2026-10-27 确认修改后文案，记录见下）。首批 1 条 `national-scholarship-amounts-2024`：2024 年起国家奖学金 10000 元、国家励志奖学金 6000 元；2024 年秋季学期起国家助学金平均资助标准 3700 元（学校在 2500—5000 元内自主确定、可分 2—3 档，`a7109da` 按财教〔2024〕181 号补入）；取代 2025 学生手册中的 8000/5000 元等旧标准；来源为财政部/教育部 2024 通知和学校 2024—2025 学年评审通知（均已核实）。
- 逻辑：`server/policy-updates.mjs` 只在问题**同时**命中主题词（国家奖学金/国家励志奖学金/奖助学金等）和金额/标准意图词（金额/标准/多少等）时返回提示；`buildRagContext(hits, { query })` 与 `formatLightragContext(response, mode, { query })` 在回答上下文中加入“现行政策提示”块；`index.mjs` 把政策来源（官方原文链接）排在来源列表前面，并按标题去重同标题的本地来源（`c78b94f`）。
- 边界：非金额问题、尚未发布年度、其他主题不注入；政策提示不作为新的“金标答案”，只是带来源的核对结论。
- 测试：`server/tests/policy-updates.test.mjs` 9 条；`npm run test:server` 78/78；`npm run server:check` PASS 83 模块；Top 20 关键词/向量 20/20；Top 50 草案关键词/向量 50/50 + 负例 10/10；诊断 12/12。
- 未完成：线上是否加载旧手册数据的确认、缺失通知正文与年度限定、逐题核验与独立问题集；内容签收已完成（`signed-off`，用户 2026-10-27）。

### 上线前确认（2026-10-27，`c78b94f` + `a7109da` + `e9385d1`）

结论：**技术层面可上线，内容已由用户签收**；正式上线仍必须走正常推送、CI、部署与 7.4 发布检查流程，不得用本记录替代发布签收。

- 部署打包：`git archive HEAD` 生成的发布包包含已跟踪文件 `server/`（含 `server/data/policy-updates.json`）；线上部署脚本会把 `release/server/data/.` 同步到 `shared/data/` 并软链回 release（`.github/deploy-remote.sh`），后续发布自动更新该文件。
- 安全降级：`POLICY_UPDATES_PATH` 指向不存在文件时，`formatPolicyUpdateContext` 返回空、`policyUpdatesToSources` 返回空数组，功能静默关闭，不影响 RAG/问答（本地已验证）。
- 单元/回归：`policy-updates.test.mjs` 9 条；`npm run test:server` 78/78；`npm run server:check` PASS 83 模块；Top 20 20/20、Top 50 50/50 + 负例 10/10；定向 ESLint/oxlint 0 error、`git diff --check` 通过。
- 真实链路（本地，真实 DeepSeek）：问“现在国家奖助学金实施办法标准是多少？”，回答明确“自 2024 年起国家奖学金 10000 元、国家励志奖学金 6000 元，2025 年学生手册的 8000/5000 为旧标准已不适用”，并提示以最新通知为准；来源前两条为 2024 国家通知与学校 2024—2025 学年评审通知。
- 国家助学金真实链路（本地，真实 DeepSeek，`a7109da`）：问“国家助学金的资助标准是多少？”，回答明确“2024 年秋季学期起平均 3700 元、学校在 2500—5000 元内自主确定、通常分 2—3 档，手册旧 3300 元不再适用”，并说明无法确认各档具体金额、需看学校当年通知；来源为 2024 国家通知和学校 2025—2026 学年评审通知。
- 非金额问题（如“申请国家奖学金对年级和成绩排名有什么要求？”）不注入政策提示，来源里没有政策提示专属的 2024 国家通知；mock 链路与真实链路一致。
- 去重：`mergePolicySources` 按标题去掉与政策来源重复的本地知识库来源（`c78b94f`），真实链路和 mock 链路均不再重复展示同一条学校通知。
- 内容签收（`e9385d1`）：用户 2026-10-27 确认修改后的政策文案可签收；`policy-updates.json` 状态改为 `signed-off`，记录 `signedAt`/`signedBy`/`signedNote`；新增 CI 守卫测试 `policy data carries a human signoff before launch`，避免未签收数据进入发布分支。
- 仍需人工：确认线上是否加载学生手册旧数据（7.4）；真实用户试用未做；上线必须按正常推送、CI、部署与 7.4 发布检查流程执行，部署完成后需复核公网金额问答与来源。
