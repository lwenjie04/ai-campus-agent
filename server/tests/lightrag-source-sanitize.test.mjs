import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildLightragSourceTitle,
  cleanLightragSnippet,
  lightragContextToSources,
} from '../lightrag.mjs'

test('LightRAG source titles map raw file paths to readable, bounded labels', () => {
  assert.equal(
    buildLightragSourceTitle({ file_path: 'student-handbook-lightrag.json#student_handbook_97774e87' }),
    '学生手册（LightRAG 切片）',
  )
  assert.equal(
    buildLightragSourceTitle({ file_path: 'chunked-knowledge-base.json#chunk_2026-03-24-3dc42764_01' }),
    '校园知识库切片',
  )
  assert.equal(buildLightragSourceTitle({ file_path: 'some-notice.pdf' }), 'some notice')
  assert.equal(buildLightragSourceTitle({ file_path: '' }, 2), 'LightRAG 参考 3')

  const longName = buildLightragSourceTitle({ file_path: `${'a'.repeat(80)}.json` })
  assert.ok(longName.length <= 26, longName)
  assert.ok(!longName.includes('#'))
})

test('LightRAG snippets are cleaned, de-identified and truncated', () => {
  const raw = `  标题：广东第二师范学院学生申诉处理办法 ${'长'.repeat(300)}  `
  const cleaned = cleanLightragSnippet(raw)
  assert.ok(cleaned.length <= 96, `snippet too long: ${cleaned.length}`)
  assert.ok(cleaned.endsWith('…'))
  assert.ok(!/ {2,}/.test(cleaned))

  const withChunkId = cleanLightragSnippet('正文 附件#student_handbook_97774e87 结束')
  assert.ok(!withChunkId.includes('student_handbook'), withChunkId)
  assert.equal(cleanLightragSnippet(''), '')
  assert.equal(cleanLightragSnippet(null), '')
  assert.equal(cleanLightragSnippet(['第一段', '第二段']), '第一段 第二段')
})

test('lightragContextToSources emits readable titles and bounded snippets', () => {
  const sources = lightragContextToSources('', [
    {
      reference_id: 'ref-1',
      file_path: 'student-handbook-lightrag.json#student_handbook_97774e87',
      content: '正文内容 '.repeat(40),
    },
    { file_path: 'mystery-file.json', content: ['数组第一段', '数组第二段'] },
    { reference_id: 'ref-3' },
  ])

  assert.equal(sources.length, 3)
  assert.equal(sources[0].title, '学生手册（LightRAG 切片）')
  assert.ok(sources[0].snippet.length <= 96)
  assert.equal(sources[1].title, 'mystery file')
  assert.equal(sources[1].snippet, '数组第一段 数组第二段')
  assert.ok(sources[2].snippet.startsWith('参考资料'))

  for (const source of sources) {
    assert.ok(!source.title.includes('#'), source.title)
    assert.ok(source.title.length <= 26, source.title)
    assert.ok(source.snippet.length <= 96, source.snippet)
    assert.equal(source.type, 'lightrag')
  }
})
