// 8-frame walk cycle (hand-maintained; scripts/build-sprites.py doesn't generate it). All frames share
// one canvas, nose- and paw-aligned. Side view facing right; the engine mirrors them for walking left.
(() => {
  const AM = globalThis.AIMeter;
  AM.IRIS_FRAMES = AM.IRIS_FRAMES || {};
  for (let i = 1; i <= 8; i++) {
    AM.IRIS_FRAMES['walk8-' + i] = { file: 'walk8-' + i + '.webp', w: 92.5, h: 82.5, ax: 47.5, ay: 1.5 };
  }
})();
