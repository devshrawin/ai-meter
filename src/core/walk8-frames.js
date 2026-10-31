// 12-frame walk cycle (hand-maintained; scripts/build-sprites.py doesn't generate it). All frames share
// one canvas, paw-aligned. Side view facing right; the engine mirrors them for walking left.
(() => {
  const AM = globalThis.AIMeter;
  AM.IRIS_FRAMES = AM.IRIS_FRAMES || {};
  const W = {"w": 85.8, "h": 69.9, "ax": 42.9, "ay": 1.5};
  for (let i = 1; i <= 12; i++) {
    AM.IRIS_FRAMES['walk8-' + i] = Object.assign({ file: 'walk8-' + i + '.webp' }, W);
  }
})();
