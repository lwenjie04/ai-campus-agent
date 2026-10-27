const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[\s（）()《》“”"'：:，,。.!！?？、·—-]/g, '')

export const isExpectedHit = (hit, item) => {
  if (!hit) return false
  const normalizedTitle = normalizeText(hit.title)
  const expectedTitles = Array.isArray(item.expectedTitleIncludes) ? item.expectedTitleIncludes : []
  return expectedTitles.some((expected) => normalizedTitle.includes(normalizeText(expected)))
}

export const isExpectedNoHit = (hits, item) => item.expectedNoHit === true && hits.length === 0

export const createRagGoldenSummary = (
  positiveResults,
  negativeResults,
  { threshold = 0.9, negativeThreshold = 1 } = {},
) => {
  const positivePassed = positiveResults.filter((item) => item.passed).length
  const positiveTotal = positiveResults.length
  const top1Accuracy = positiveTotal > 0 ? positivePassed / positiveTotal : 0
  const negativePassed = negativeResults.filter((item) => item.passed).length
  const negativeTotal = negativeResults.length
  const negativeAccuracy = negativeTotal > 0 ? negativePassed / negativeTotal : 1
  const status =
    positiveTotal > 0 &&
    top1Accuracy >= threshold &&
    (negativeTotal === 0 || negativeAccuracy >= negativeThreshold)
      ? 'pass'
      : 'fail'

  return {
    total: positiveTotal,
    passed: positivePassed,
    failed: positiveTotal - positivePassed,
    top1Accuracy: Number(top1Accuracy.toFixed(4)),
    threshold,
    negativeTotal,
    negativePassed,
    negativeFailed: negativeTotal - negativePassed,
    negativeAccuracy: Number(negativeAccuracy.toFixed(4)),
    negativeThreshold,
    status,
  }
}
