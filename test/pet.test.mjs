// Iris's state machine: mood, trips, falls and recovery, reduced motion, hidden tab, pick-up. No pixels.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPet } from './pet-harness.mjs';

test('mood sets the resting pose: worried and stressed look different, and she is happy again below 75', async () => {
  const p = loadPet({ calm: true });
  p.pet.setExplore(false);
  await p.step(2000);
  assert.equal(p.pose(), 'sit');
  p.pet.setMood('worried');
  await p.step(1500);
  assert.equal(p.pose(), 'sit-worried');
  p.pet.setMood('stressed');
  await p.step(1500);
  assert.equal(p.pose(), 'sit-stressed');
  p.pet.setMood('happy');
  await p.step(1500);
  assert.equal(p.pose(), 'sit');
});

test('at 100% (sleep) she lies down; when usage resets she gets up again', async () => {
  const p = loadPet();
  await p.step(1500);
  p.pet.setMood('sleep');
  await p.step(8000);
  assert.equal(p.pose(), 'sleep');
  p.pet.setMood('happy');
  await p.step(8000);
  assert.notEqual(p.pose(), 'sleep');
});

test('crossing into 90% (stressed) raises the alarm: she goes to the limit banner or the chat box', async () => {
  const p = loadPet();
  await p.step(2000);
  p.pet.setMood('worried');
  await p.step(500);
  p.pet.setMood('stressed');
  await p.step(600);
  assert.ok(p.asked.includes('limitBanner') || p.asked.includes('composer'), 'she looked for somewhere to go: ' + p.asked);
  assert.equal(p.pet.tripping, true);
});

test('the alarm is raised once per crossing, and not when waking from sleep into stressed', async () => {
  const p = loadPet();
  await p.step(2000);
  p.pet.setMood('sleep');
  await p.step(8000);
  p.asked.length = 0;
  p.pet.setMood('stressed');
  await p.step(600);
  assert.equal(p.asked.length, 0, 'no alarm trip from sleep');
});

test('she gets home after a trip: not tripping, on the pill, in her resting pose', async () => {
  const p = loadPet();
  await p.step(2000);
  p.AM.bus.dispatchEvent(new Event('send')); // a reply arrived: a short trip to the chat box
  await p.step(600);
  assert.equal(p.pet.tripping, true);
  await p.step(30000);
  assert.equal(p.pet.tripping, false);
  assert.equal(p.pos().y, 0);
});

test('perch disappears mid-trip: she falls, is dazed, and recovers on the pill', async () => {
  const p = loadPet();
  await p.step(2000);
  p.AM.bus.dispatchEvent(new Event('send'));
  const seen = new Set();
  let removed = false;
  for (let i = 0; i < 2000; i++) {
    await p.step(50);
    seen.add(p.pose());
    if (!removed && p.pet.tripping && p.pos().y < -20) { p.composer.parent && p.composer.remove(); removed = true; }
    if (removed && !p.pet.tripping && p.pos().y === 0) break;
  }
  assert.ok(removed, 'she reached the perch');
  assert.ok(seen.has('fall'), 'she fell: ' + [...seen]);
  assert.ok(seen.has('dazed'), 'and sat dazed: ' + [...seen]);
  assert.equal(p.pet.tripping, false);
  assert.equal(p.pos().y, 0, 'back on the pill');
});

test('perch moves mid-trip: same recovery', async () => {
  const p = loadPet();
  await p.step(2000);
  p.AM.bus.dispatchEvent(new Event('send'));
  const seen = new Set();
  let moved = false;
  for (let i = 0; i < 2000; i++) {
    await p.step(50);
    seen.add(p.pose());
    if (!moved && p.pet.tripping && p.pos().y < -20 && p.pose() === 'sit-happy') { p.rect.top += 60; moved = true; }
    if (moved && !p.pet.tripping && p.pos().y === 0) break;
  }
  assert.ok(moved && seen.has('fall'), [...seen].join());
  assert.equal(p.pos().y, 0);
});

test('dragging the pill mid-trip snaps her home at once and blocks new trips until it ends', async () => {
  const p = loadPet();
  await p.step(2000);
  p.AM.bus.dispatchEvent(new Event('send'));
  await p.step(2500);
  assert.equal(p.pet.tripping, true);
  p.pet.setDragging(true);
  await p.step(32);
  assert.equal(p.pos().y, 0);
  await p.step(500);
  assert.equal(p.pet.tripping, false);
  p.AM.bus.dispatchEvent(new Event('send'));
  await p.step(3000);
  assert.equal(p.pet.tripping, false, 'no trip while the pill is being dragged');
  p.pet.setDragging(false);
  p.AM.bus.dispatchEvent(new Event('send'));
  await p.step(3000);
  assert.equal(p.pet.tripping, true, 'trips resume afterwards');
});

test('reduced motion: no trips, no alarm, no walking, no pick-up; she stays home', async () => {
  const p = loadPet({ reduce: true });
  await p.step(2000);
  p.pet.setMood('worried');
  p.pet.setMood('stressed');
  p.AM.bus.dispatchEvent(new Event('send'));
  p.AM.bus.dispatchEvent(new Event('limit'));
  await p.step(20000);
  assert.equal(p.pet.tripping, false);
  assert.equal(p.asked.length, 0);
  assert.equal(p.pos().y, 0);
  assert.equal(p.pet.grab(100, 100), false, 'she cannot be picked up');
});

test('hidden tab: no trip starts while the page is hidden', async () => {
  const p = loadPet();
  await p.step(2000);
  p.document.hidden = true;
  p.AM.bus.dispatchEvent(new Event('send'));
  p.AM.bus.dispatchEvent(new Event('limit'));
  await p.step(10000);
  assert.equal(p.pet.tripping, false);
  assert.equal(p.asked.length, 0);
});

test('a long gap between frames (a throttled background tab) does not fast-forward her', async () => {
  const p = loadPet();
  await p.step(1500);
  const before = p.pos();
  p.setClock(1_000_000 + 600_000); // ten minutes pass with no frame
  await p.step(32);
  assert.deepEqual(p.pos(), before, 'she did not teleport or run an hour of idle behaviour in one frame');
  assert.equal(p.pet.tripping, false);
});

test('explore off: she never goes on trips', async () => {
  const p = loadPet();
  p.pet.setExplore(false);
  await p.step(2000);
  p.AM.bus.dispatchEvent(new Event('send'));
  p.pet.setMood('worried');
  p.pet.setMood('stressed');
  await p.step(8000);
  assert.equal(p.pet.tripping, false);
});

test('asleep she does not go on trips either', async () => {
  const p = loadPet();
  await p.step(2000);
  p.pet.setMood('sleep');
  await p.step(8000);
  p.asked.length = 0;
  p.AM.bus.dispatchEvent(new Event('send'));
  await p.step(3000);
  assert.equal(p.pet.tripping, false);
  assert.equal(p.asked.length, 0);
});

test('with no perch anywhere (page layout changed) a trip request is dropped, not stuck', async () => {
  const p = loadPet();
  p.AM.findPerch = () => null;
  await p.step(2000);
  p.AM.bus.dispatchEvent(new Event('send'));
  await p.step(5000);
  assert.equal(p.pet.tripping, false);
  p.AM.findPerch = () => p.composer;
  p.AM.bus.dispatchEvent(new Event('send'));
  await p.step(2000);
  assert.equal(p.pet.tripping, true, 'the next request still works');
});

test('pick up and drop: she is held, then runs back to the pill', async () => {
  const p = loadPet({ calm: true });
  await p.step(2000);
  assert.equal(p.pet.grab(300, 300), true);
  assert.equal(p.pet.held, true);
  p.pet.carry(320, 310);
  await p.step(500);
  assert.ok(p.pos().y < 0, 'dangling above the pill');
  p.pet.drop(320, 310);
  await p.step(25000);
  assert.equal(p.pet.held, false);
  assert.equal(p.pos().y, 0);
});

test('picking her up during a trip ends the trip', async () => {
  const p = loadPet();
  await p.step(2000);
  p.AM.bus.dispatchEvent(new Event('send'));
  await p.step(2500);
  assert.equal(p.pet.tripping, true);
  assert.equal(p.pet.grab(200, 200), true);
  await p.step(300);
  assert.equal(p.pet.tripping, false);
});

test('destroy stops the clock, removes her, and unhooks the page events', async () => {
  const p = loadPet();
  await p.step(1000);
  p.pet.destroy();
  assert.equal(p.raf(), null, 'no further animation frames');
  assert.equal(p.pill.children.includes(p.pet.el), false);
  p.asked.length = 0;
  p.AM.bus.dispatchEvent(new Event('send'));
  p.AM.bus.dispatchEvent(new Event('limit'));
  assert.equal(p.asked.length, 0);
});

test('leave: she walks off and fades out', async () => {
  const p = loadPet();
  await p.step(2000);
  let done = false;
  p.pet.leave().then(() => { done = true; });
  for (let i = 0; i < 400 && !done; i++) { await p.step(50); await new Promise((r) => setImmediate(r)); }
  assert.equal(done, true);
  assert.equal(p.pet.el.style.opacity, '0');
});
