
/**
 * Suggestion #20: Bundle size monitoring
 * Track and report loaded chunk sizes
 */

export const reportBundleSizes = () => {
  if (typeof window === 'undefined' || !window.performance) return;

  const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  
  const jsChunks = entries
    .filter(e => e.name.endsWith('.js') || e.name.includes('.js?'))
    .map(e => ({
      name: e.name.split('/').pop()?.split('?')[0] || e.name,
      size: e.transferSize,
      duration: Math.round(e.duration),
    }))
    .sort((a, b) => b.size - a.size);

  const totalJS = jsChunks.reduce((sum, c) => sum + c.size, 0);

  console.group('[Bundle Analysis]');
  console.log(`Total JS transferred: ${(totalJS / 1024).toFixed(1)} KB`);
  jsChunks.slice(0, 10).forEach(chunk => {
    console.log(`  ${chunk.name}: ${(chunk.size / 1024).toFixed(1)} KB (${chunk.duration}ms)`);
  });
  console.groupEnd();

  return { totalJS, chunks: jsChunks };
};

// CSS chunks
export const reportCSSBundles = () => {
  const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  
  const cssChunks = entries
    .filter(e => e.name.endsWith('.css') || e.name.includes('.css?'))
    .map(e => ({
      name: e.name.split('/').pop()?.split('?')[0] || e.name,
      size: e.transferSize,
    }));

  const totalCSS = cssChunks.reduce((sum, c) => sum + c.size, 0);
  console.log(`[Bundle] Total CSS: ${(totalCSS / 1024).toFixed(1)} KB`);

  return { totalCSS, chunks: cssChunks };
};
