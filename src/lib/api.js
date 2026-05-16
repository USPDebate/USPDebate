// Cliente da API do Apps Script via JSONP (não passa por CORS).

const API_URL = 'https://script.google.com/macros/s/AKfycbxlRTkB1GjcRITvLzfLkw3sH4LLOVsCEEv4WXhK_bL7s2Yib7raK8UsEjKTFBZJX1C1/exec';

export function callAPI(action, payload) {
  return new Promise((resolve, reject) => {
    const cb = '_jsonp_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
    const script = document.createElement('script');
    let done = false;
    const timer = setTimeout(() => { if (!done) { cleanup(); reject(new Error('Tempo esgotado')); } }, 30000);
    function cleanup() {
      done = true;
      delete window[cb];
      clearTimeout(timer);
      if (script.parentNode) script.parentNode.removeChild(script);
    }
    window[cb] = (resp) => {
      cleanup();
      if (resp && resp.sucesso) resolve(resp.data);
      else reject(new Error((resp && resp.erro) || 'Erro na API'));
    };
    script.onerror = () => { if (!done) { cleanup(); reject(new Error('Erro de conexão')); } };
    // anônimo: não envia cookies do Google → evita o erro de roteamento
    // entre múltiplas contas (Apps Script "Qualquer pessoa").
    script.crossOrigin = 'anonymous';
    script.src = API_URL
      + '?action=' + encodeURIComponent(action)
      + '&callback=' + cb
      + '&p=' + encodeURIComponent(JSON.stringify(payload || {}));
    document.head.appendChild(script);
  });
}

// Cache de leitura no cliente (evita requests repetidos em troca de aba).
const _cache = {};
export function callAPICached(action, payload, ttlMs) {
  const key = action + '|' + JSON.stringify(payload || {});
  const hit = _cache[key];
  if (hit && (Date.now() - hit.t) < ttlMs) return Promise.resolve(hit.v);
  return callAPI(action, payload).then((v) => { _cache[key] = { t: Date.now(), v }; return v; });
}
export function invalidate(action) {
  Object.keys(_cache).forEach((k) => { if (k.indexOf(action + '|') === 0) delete _cache[k]; });
}
