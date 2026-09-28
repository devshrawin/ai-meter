// Pure response parsers for provider usage endpoints. No chrome.* or DOM access here.
// Endpoint shapes were learned from RateBucket, claudetuner and CodexBar (all MIT).
(() => {
  const AM = globalThis.AIMeter;
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
  const ratioToPct = (r) => (r >= 0 && r <= 1 ? r * 100 : r);

  AM.spanLabel = (secs) => {
    if (!secs || secs <= 0) return null;
    const h = secs / 3600;
    if (h <= 36) return `${Math.round(h)}h`;
    const d = h / 24;
    if (Math.abs(d - 7) < 0.6) return 'Weekly';
    if (d >= 27 && d <= 32) return 'Monthly';
    return `${Math.round(d)}d`;
  };

  // ChatGPT GET /backend-api/wham/usage (Codex limits; needs Bearer from /api/auth/session).
  // Windows are classified by span, not slot: some plans put the 7d window in primary_window.
  AM.parseChatGPTUsage = (j, prefix = 'Codex') => {
    if (!j || typeof j !== 'object') return [];
    const meters = [];
    const add = (id, name, w) => {
      if (!w || num(w.used_percent) == null) return;
      const span = num(w.limit_window_seconds);
      const sl = AM.spanLabel(span);
      const label = name || (sl ? `${prefix} · ${sl}` : prefix);
      meters.push({
        id,
        label,
        pct: w.used_percent,
        resetAt: AM.toTime(w.reset_at) || AM.toTime(w.reset_after_seconds, 'rel'),
        source: 'real',
      });
    };
    const rl = j.rate_limit;
    if (rl) {
      for (const [slot, w] of [['primary', rl.primary_window], ['secondary', rl.secondary_window]]) {
        if (!w) continue;
        const span = num(w.limit_window_seconds);
        add(`codex-${span || slot}`, null, w);
      }
    }
    const extra = Array.isArray(j.additional_rate_limits) ? j.additional_rate_limits.slice(0, 5) : [];
    for (const item of extra) {
      const w = item && item.rate_limit && (item.rate_limit.primary_window || item.rate_limit.secondary_window);
      const name = String((item && (item.limit_name || item.metered_feature)) || 'Limit').trim().slice(0, 60);
      add(`extra-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name, w);
    }
    if (j.code_review_rate_limit) add('code-review', `${prefix} · code review`, j.code_review_rate_limit.primary_window);
    const cr = j.credits;
    if (cr && !cr.unlimited && num(Number(cr.balance)) != null && Number(cr.balance) > 0) {
      meters.push({ id: 'credits', label: 'Credits', remaining: Number(cr.balance), source: 'real' });
    }
    return meters;
  };

  // Gemini batchexecute rpcid jSf9Qc. Payload buckets: [remaining, usedRatio, type, [[sec, nanos]]].
  AM.parseGeminiUsage = (text) => {
    if (typeof text !== 'string') return { meters: [], error: 'no text' };
    const body = text.startsWith(")]}'") ? text.slice(4) : text;
    const frames = [];
    for (const line of body.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || /^\d+$/.test(t)) continue;
      try { frames.push(JSON.parse(t)); } catch {}
    }
    let payloadStr = null;
    let errStatus = null;
    const walk = (v) => {
      if (!Array.isArray(v) || payloadStr) return;
      if (v[0] === 'wrb.fr' && v[1] === 'jSf9Qc' && typeof v[2] === 'string') { payloadStr = v[2]; return; }
      if (v[0] === 'er' && errStatus == null) errStatus = num(v[5]);
      v.forEach(walk);
    };
    frames.forEach(walk);
    if (!payloadStr) return { meters: [], error: errStatus != null ? `rpc error ${errStatus}` : 'payload missing' };
    let payload;
    try { payload = JSON.parse(payloadStr); } catch { return { meters: [], error: 'payload parse failed' }; }
    const buckets = Array.isArray(payload) && Array.isArray(payload[1]) ? payload[1] : [];
    const meters = [];
    for (const b of buckets) {
      if (!Array.isArray(b)) continue;
      const ratio = num(b[1]);
      const type = num(b[2]);
      if (ratio == null || type == null) continue;
      const ts = Array.isArray(b[3]) && Array.isArray(b[3][0]) ? b[3][0] : null;
      const sec = ts ? num(ts[0]) : null;
      meters.push({
        id: type === 1 ? 'session' : type === 2 ? 'weekly' : `bucket-${type}`,
        label: type === 1 ? 'Session (5h)' : type === 2 ? 'Weekly' : `Bucket ${type}`,
        pct: ratioToPct(ratio),
        resetAt: sec != null ? Math.round((sec + (num(ts[1]) || 0) / 1e9) * 1000) : undefined,
        source: 'real',
      });
    }
    return { meters, error: meters.length ? null : 'no buckets' };
  };

  // Kimi MembershipService/GetSubscription: balances[].{feature, amountUsedRatio, expireTime}.
  const KIMI_LABELS = { FEATURE_OMNI: 'Credits' };
  AM.parseKimiUsage = (j) => {
    if (!j || !Array.isArray(j.balances)) return [];
    return j.balances
      .filter((b) => b && num(b.amountUsedRatio) != null)
      .map((b) => {
        const f = String(b.feature || 'usage');
        return {
          id: f.toLowerCase().replace(/^feature_/, ''),
          label: KIMI_LABELS[f] || AM.prettyKey(f.replace(/^FEATURE_/, '').toLowerCase()),
          pct: ratioToPct(b.amountUsedRatio),
          resetAt: AM.toTime(b.expireTime),
          source: 'real',
        };
      });
  };

  // --- Claude per-chat stats (estimates) ---
  // Claude's tokenizer yields ~1.4x the tokens of GPT's o200k (~4 chars/token), so ~0.35 tokens/char.
  const TOKENS_PER_CHAR = 0.35;
  const SYSTEM_TOKENS = 3200;
  const FILE_TOKENS = 1600;
  AM.CLAUDE_CACHE_MS = 3600e3;

  AM.estimateTokens = (text) => Math.ceil(String(text || '').length * TOKENS_PER_CHAR);

  // Thinking and tool results aren't re-sent on later turns, so they don't count toward length.
  const blockText = (b) => {
    if (!b || typeof b !== 'object') return '';
    if (b.type === 'thinking' || b.type === 'redacted_thinking' || b.type === 'tool_result') return '';
    let s = typeof b.text === 'string' ? b.text : '';
    if (b.input) s += JSON.stringify(b.input);
    if (Array.isArray(b.content)) s += b.content.map(blockText).join('');
    return s;
  };

  const messageTokens = (m) => {
    let text = Array.isArray(m.content) ? m.content.map(blockText).join('') : (m.text || '');
    for (const a of m.attachments || []) if (a && a.extracted_content) text += a.extracted_content;
    const files = (m.files_v2 || m.files || []).length;
    return AM.estimateTokens(text) + files * FILE_TOKENS;
  };

  // Current branch: walk back from the leaf when the tree is present, else take the list in order.
  const currentBranch = (conv) => {
    const all = Array.isArray(conv.chat_messages) ? conv.chat_messages : [];
    const leaf = conv.current_leaf_message_uuid;
    if (!leaf || !all.some((m) => m.parent_message_uuid)) {
      return all.slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    }
    const byId = new Map(all.map((m) => [m.uuid, m]));
    const out = [];
    for (let m = byId.get(leaf); m && out.length <= all.length; m = byId.get(m.parent_message_uuid)) out.unshift(m);
    return out;
  };

  AM.claudeChatStats = (conv, now = Date.now()) => {
    if (!conv || typeof conv !== 'object') return null;
    const msgs = currentBranch(conv);
    if (!msgs.length) return { tokens: SYSTEM_TOKENS, messages: 0, nextCost: SYSTEM_TOKENS, cachedUntil: null, model: conv.model || null };
    const per = msgs.map(messageTokens);
    const tokens = SYSTEM_TOKENS + per.reduce((a, b) => a + b, 0);
    const last = msgs[msgs.length - 1];
    const lastAt = Date.parse(last.created_at || last.updated_at || '') || null;
    const cachedUntil = lastAt ? lastAt + AM.CLAUDE_CACHE_MS : null;
    const cached = cachedUntil != null && cachedUntil > now;
    // While cached, only the newest reply is re-read at full cost; after expiry the whole chat is.
    const nextCost = cached ? per[per.length - 1] : tokens;
    return { tokens, messages: msgs.length, lastAt, cachedUntil, nextCost, model: conv.model || null };
  };

  AM.fmtTokens = (n) => {
    if (n == null || !isFinite(n)) return '';
    if (n < 1000) return String(Math.round(n));
    if (n < 100000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    if (n < 1e6) return Math.round(n / 1000) + 'k';
    return (n / 1e6).toFixed(2).replace(/0$/, '') + 'M';
  };

  AM.b64ToBytes = (b64) => {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };

  // gRPC-web frames: [flags:1][length:4 BE][payload]; flags & 0x80 marks the trailer frame.
  const grpcFrames = (bytes) => {
    const data = [];
    let trailer = '';
    let i = 0;
    while (i < bytes.length) {
      if (i + 5 > bytes.length) return null;
      const flags = bytes[i];
      const len = ((bytes[i + 1] << 24) >>> 0) + (bytes[i + 2] << 16) + (bytes[i + 3] << 8) + bytes[i + 4];
      const start = i + 5;
      const end = start + len;
      if (end > bytes.length) return null;
      if (flags & 0x80) trailer += String.fromCharCode(...bytes.subarray(start, end));
      else data.push(bytes.subarray(start, end));
      i = end;
    }
    return { data, trailer };
  };

  const readVarint = (b, pos) => {
    let result = 0;
    let mult = 1;
    for (let k = 0; k < 10 && pos.i < b.length; k++) {
      const byte = b[pos.i++];
      result += (byte & 0x7f) * mult;
      if (!(byte & 0x80)) return result;
      mult *= 128;
    }
    return null;
  };

  // Only descend into sub-messages the billing descriptor declares; other bytes fields may be opaque.
  const GROK_MESSAGES = new Set(['1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8', '1.12',
    '1.6.1', '1.6.2', '1.6.3', '1.8.2', '1.8.3', '1.6.3.2', '1.6.3.3']);

  const scanProto = (b, path, out, depth) => {
    const pos = { i: 0 };
    while (pos.i < b.length) {
      const key = readVarint(b, pos);
      if (key == null || key < 8) return;
      const field = Math.floor(key / 8);
      const wire = key % 8;
      const p = path.concat(field);
      if (wire === 0) {
        const v = readVarint(b, pos);
        if (v == null) return;
        out.varints.push({ path: p.join('.'), value: v });
      } else if (wire === 1) {
        pos.i += 8;
      } else if (wire === 2) {
        const len = readVarint(b, pos);
        if (len == null || pos.i + len > b.length) return;
        const sub = b.subarray(pos.i, pos.i + len);
        pos.i += len;
        if (depth < 4 && GROK_MESSAGES.has(p.join('.'))) scanProto(sub, p, out, depth + 1);
      } else if (wire === 5) {
        if (pos.i + 4 > b.length) return;
        const f = new DataView(b.buffer, b.byteOffset + pos.i, 4).getFloat32(0, true);
        out.floats.push({ path: p, value: f, order: out.floats.length });
        pos.i += 4;
      } else {
        return;
      }
    }
  };

  // Grok grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig (weekly percentage pool).
  AM.parseGrokCredits = (bytes, now = Date.now()) => {
    const framed = grpcFrames(bytes);
    const payloads = framed && framed.data.length ? framed.data : [bytes];
    if (framed && /grpc-status:\s*([1-9]\d*)/i.test(framed.trailer)) {
      return { meters: [], error: 'grpc ' + framed.trailer.trim().replace(/\s+/g, ' ').slice(0, 120) };
    }
    const out = { varints: [], floats: [] };
    for (const p of payloads) scanProto(p, [], out, 0);

    const pctField = out.floats
      .filter((f) => f.path[f.path.length - 1] === 1 && isFinite(f.value) && f.value >= 0 && f.value <= 100)
      .sort((a, b) => a.path.length - b.path.length || a.order - b.order)[0];
    const epochs = out.varints.filter((v) => v.value >= 1.7e9 && v.value <= 2.1e9);
    const future = epochs.filter((v) => v.value * 1000 > now);
    const preferred = future.filter((v) => v.path === '1.5.1');
    const pick = (preferred.length ? preferred : future).map((v) => v.value * 1000);
    const resetAt = pick.length ? Math.min(...pick) : undefined;
    const hasPeriod = out.varints.some((v) => v.path.startsWith('1.6') || (v.path === '1.8.1' && (v.value === 1 || v.value === 2)));

    let pct = pctField ? pctField.value : null;
    if (pct == null && !out.floats.length && resetAt && hasPeriod) pct = 0;
    if (pct == null) return { meters: [], error: 'no usage percent in payload' };
    return {
      meters: [{ id: 'weekly', label: 'Weekly usage', pct: Math.round(pct * 10) / 10, resetAt, source: 'real' }],
      error: null,
    };
  };
})();
