let commitCount = 0;
let lastSampleTime = 0;

export function recordRenderCommit() {
  commitCount += 1;
}

export function takeRenderRate(now) {
  if (lastSampleTime === 0) {
    lastSampleTime = now;
    const initial = commitCount;
    commitCount = 0;
    return initial;
  }

  const elapsed = Math.max(now - lastSampleTime, 1);
  const rate = (commitCount * 1000) / elapsed;
  commitCount = 0;
  lastSampleTime = now;
  return rate;
}
