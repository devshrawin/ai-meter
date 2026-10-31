const CHAT = `<div class="chat"><div class="msg me">Can you summarise the main risks in this contract?</div><div class="msg ai">Three things stand out: the auto-renewal clause, the liability cap, and the unusual termination notice period. Want me to go through each one?</div><div class="msg me">Yes, start with the liability cap.</div><div class="msg ai">The cap is set at the fees paid in the last twelve months, which is common, but it excludes data loss. That is the part worth negotiating.</div></div>`;
(() => {
  const AM = globalThis.AIMeter;
  const q = new URLSearchParams(location.search);
  const state = q.get('state') || 'ok';
  const PCT = { ok: 32, warn: 80, hot: 96, full: 100 };
  if (q.get('scene') === 'chat') document.querySelector('.page').innerHTML = CHAT;
  if (q.get('bare') === '1') document.querySelector('.page').remove();
  const now = Date.now(), H = 3600e3;
  const claude = [
    { id: 'five_hour', label: 'Session (5h)', pct: PCT[state] ?? 32, resetAt: now + 3 * H + 12 * 60e3, source: 'real' },
    { id: 'seven_day', label: 'Weekly', pct: state === 'hot' ? 81 : state === 'warn' ? 40 : state === 'full' ? 100 : 9, resetAt: now + 2 * 24 * H, source: 'real' },
  ];
  const est = [{ id: 'messages', label: 'Messages', used: 52, limit: 160, resetAt: now + 2 * H, source: 'estimate' }];
  const meters = state === 'problem' || state === 'signin' ? [] : state === 'estimate' ? est : claude;
  const problem = state === 'problem' ? { kind: 'error', text: 'The usage response had no usage figures', since: 0 } : state === 'signin' ? { kind: 'signin', text: '', since: 0 } : null;
  const chat = { tokens: 18400, messages: 14, cachedUntil: now + 3 * 60e3, nextCost: 2100, note: 'Longer chats use more of your limit' };
  AM.setSetting = async () => {};
  AM.copyDiagnostics = async () => true;
  AM.loadPet = () => Promise.resolve();
  AM.siteId = 'claude';
  AM.widget.update('Claude', meters, { widget: true, pet: q.get('pet') !== '0', explore: false, irisEnergy: 'calm', meterStyle: q.get('style') || 'pill' }, q.get('bare') === '1' ? null : chat, problem);
  if (q.get('open') === '1') setTimeout(() => {
    const pill = document.querySelector('[data-aimeter]').shadowRoot.querySelector('.pill');
    const ev = (t) => pill.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: 5, clientY: 5, pointerId: 1 }));
    ev('pointerdown'); ev('pointerup');
  }, 400);
})();
