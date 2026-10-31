(() => {
  const AM = globalThis.AIMeter;
  const q = new URLSearchParams(location.search);
  const state = q.get('state') || 'ok';
  const now = Date.now(), H = 3600e3;
  const claude = [
    { id: 'five_hour', label: 'Session (5h)', pct: state === 'hot' ? 96 : 32, resetAt: now + 3 * H + 12 * 60e3, source: 'real' },
    { id: 'seven_day', label: 'Weekly', pct: state === 'hot' ? 81 : 9, resetAt: now + 2 * 24 * H, source: 'real' },
  ];
  const est = [{ id: 'messages', label: 'Messages', used: 52, limit: 160, resetAt: now + 2 * H, source: 'estimate' }];
  const meters = state === 'problem' ? [] : state === 'estimate' ? est : claude;
  const problem = state === 'problem' ? { kind: 'error', text: 'The usage response had no usage figures', since: 0 } : null;
  const chat = { tokens: 18400, messages: 14, cachedUntil: now + 3 * 60e3, nextCost: 2100, note: 'Longer chats use more of your limit' };
  AM.setSetting = async () => {};
  AM.copyDiagnostics = async () => true;
  AM.loadPet = () => Promise.resolve();
  AM.siteId = 'claude';
  AM.widget.update('Claude', meters, { widget: true, pet: q.get('pet') !== '0', explore: false, irisEnergy: 'calm' }, chat, problem);
  if (q.get('open') === '1') setTimeout(() => {
    const pill = document.querySelector('[data-aimeter]').shadowRoot.querySelector('.pill');
    const ev = (t) => pill.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: 5, clientY: 5, pointerId: 1 }));
    ev('pointerdown'); ev('pointerup');
  }, 400);
})();
