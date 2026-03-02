// delta.js

function calculateDelta(currentScores, previousScores) {
  if (!previousScores) return { overall: null, seo: null, ai: null, geo: null };
  return {
    overall: (currentScores.overall - previousScores.overall),
    seo: (currentScores.seo - previousScores.seo),
    ai: (currentScores.ai - previousScores.ai),
    geo: (currentScores.geo - previousScores.geo)
  };
}

function matchFindings(currentFindings, previousFindings) {
  const prevMap = new Map();
  previousFindings.forEach(f => prevMap.set(f.id, f));
  const result = { new: [], fixed: [], persistent: [] };
  currentFindings.forEach(f => {
    if (prevMap.has(f.id)) {
      result.persistent.push(f);
      prevMap.delete(f.id);
    } else {
      result.new.push(f);
    }
  });
  // remaining in prevMap are fixed
  result.fixed = Array.from(prevMap.values());
  return result;
}

module.exports = { calculateDelta, matchFindings };
