/**
 * URL Shortener (urlShort)
 * - OpenAPI: is.gd (https://is.gd/apishorteningreference.php), fallback: v.gd
 * - 브라우저 CORS 제약이 없도록 JSONP 방식으로 호출 (API Key 불필요, file:// 실행 가능)
 */
(() => {
  'use strict';

  const API_ENDPOINTS = [
    { name: 'is.gd', url: 'https://is.gd/create.php' },
    { name: 'v.gd',  url: 'https://v.gd/create.php' }
  ];
  const TIMEOUT_MS = 8000;
  const HISTORY_KEY = 'urlShort.history';
  const HISTORY_MAX = 5;

  // ----- DOM -----
  const form          = document.getElementById('shortForm');
  const urlInput      = document.getElementById('urlInput');
  const btnShorten    = document.getElementById('btnShorten');
  const resultGroup   = document.getElementById('resultGroup');
  const resultOutput  = document.getElementById('resultOutput');
  const resultMeta    = document.getElementById('resultMeta');
  const btnCopy       = document.getElementById('btnCopy');
  const errorMsg      = document.getElementById('errorMsg');
  const toast         = document.getElementById('toast');
  const toastMsg      = document.getElementById('toastMsg');
  const historySection = document.getElementById('historySection');
  const historyList   = document.getElementById('historyList');
  const btnClearHistory = document.getElementById('btnClearHistory');

  let isLoading = false;

  // ===== 3-2. 입력 필드가 비어 있으면 '단축하기' 버튼 비활성화 =====
  function updateShortenButton() {
    btnShorten.disabled = isLoading || urlInput.value.trim() === '';
  }
  urlInput.addEventListener('input', () => {
    updateShortenButton();
    hideError();
  });
  updateShortenButton();

  // ===== URL 정규화 / 검증 =====
  function normalizeUrl(raw) {
    let value = raw.trim();
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = 'https://' + value;
    try {
      const u = new URL(value);
      if (!['http:', 'https:'].includes(u.protocol) || !u.hostname.includes('.')) return null;
      return u.href;
    } catch {
      return null;
    }
  }

  // ===== JSONP 요청 =====
  function jsonp(baseUrl, params) {
    return new Promise((resolve, reject) => {
      const cbName = `__urlShortCb_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
      const script = document.createElement('script');
      const query = new URLSearchParams({ ...params, callback: cbName }).toString();
      let settled = false;

      const cleanup = () => {
        clearTimeout(timer);
        script.onload = null;
        script.onerror = null;
        delete window[cbName];
        script.remove();
      };
      const fail = (message) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(message));
      };
      const timer = setTimeout(() => {
        fail('요청 시간이 초과되었습니다. 네트워크 연결 또는 단축 서비스 상태를 확인해 주세요.');
      }, TIMEOUT_MS);

      window[cbName] = (data) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(data);
      };
      // HTTP 200이어도 오류 문자열만 반환하면 JSONP 콜백이 실행되지 않습니다.
      script.onload = () => fail('단축 서비스가 비정상 응답을 반환했습니다. 잠시 후 다시 시도해 주세요.');
      script.onerror = () => fail('단축 서비스 응답을 불러오지 못했습니다. 네트워크 연결 또는 요청 차단 여부를 확인해 주세요.');
      script.src = `${baseUrl}?${query}`;
      document.body.appendChild(script);
    });
  }

  // ===== 3-3. OpenAPI로 URL 단축 요청 =====
  async function requestShortUrl(longUrl) {
    const failures = [];
    for (const api of API_ENDPOINTS) {
      try {
        const data = await jsonp(api.url, { format: 'json', url: longUrl });
        if (data && data.shorturl) return { shortUrl: data.shorturl, provider: api.name };
        // API가 오류코드를 반환한 경우 (1: 잘못된 URL 등) → 다음 API 시도 없이 즉시 실패
        if (data && data.errorcode === 1) throw Object.assign(new Error(data.errormessage), { fatal: true });
        throw new Error((data && data.errormessage) || '알 수 없는 응답입니다.');
      } catch (err) {
        if (err.fatal) throw err;
        failures.push(`${api.name}: ${err.message}`);
      }
    }
    throw new Error(failures.join(' / ') || 'URL 단축에 실패했습니다.');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (btnShorten.disabled) return;

    const longUrl = normalizeUrl(urlInput.value);
    if (!longUrl) {
      showError('올바른 URL 형식이 아닙니다. 예) https://example.com');
      return;
    }

    setLoading(true);
    hideError();
    try {
      const { shortUrl, provider } = await requestShortUrl(longUrl);
      showResult(shortUrl, longUrl, provider);
      addHistory(shortUrl, longUrl);
    } catch (err) {
      clearResult();
      showError(`단축 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  });

  function setLoading(state) {
    isLoading = state;
    btnShorten.classList.toggle('loading', state);
    urlInput.readOnly = state;
    updateShortenButton();
  }

  function showResult(shortUrl, longUrl, provider) {
    resultOutput.value = shortUrl;
    resultMeta.textContent = `원본: ${longUrl} · 제공: ${provider}`;
    btnCopy.disabled = false;
    resultGroup.classList.remove('has-result');
    void resultGroup.offsetWidth; // 애니메이션 재실행
    resultGroup.classList.add('has-result');
  }

  function clearResult() {
    resultOutput.value = '';
    resultMeta.textContent = '';
    btnCopy.disabled = true;
    resultGroup.classList.remove('has-result');
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.remove('show');
    void errorMsg.offsetWidth;
    errorMsg.classList.add('show');
  }
  function hideError() { errorMsg.classList.remove('show'); }

  // ===== 3-4. 복사 + '복사하였습니다' 알림창 =====
  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch { /* fallback 진행 */ }

    // Fallback: execCommand
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-9999px;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }

  let toastTimer = null;
  function showToast(msg) {
    toastMsg.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
  }

  async function handleCopy(text) {
    if (!text) return;
    const ok = await copyText(text);
    showToast(ok ? '복사하였습니다' : '복사에 실패했습니다. 직접 선택해 복사해 주세요.');
  }

  btnCopy.addEventListener('click', () => handleCopy(resultOutput.value));
  resultOutput.addEventListener('focus', () => resultOutput.select());

  // ===== 최근 단축 기록 (localStorage) =====
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch { return []; }
  }
  function saveHistory(list) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch { /* 무시 */ }
  }
  function addHistory(shortUrl, longUrl) {
    const list = loadHistory().filter((h) => h.shortUrl !== shortUrl);
    list.unshift({ shortUrl, longUrl });
    saveHistory(list.slice(0, HISTORY_MAX));
    renderHistory();
  }
  function renderHistory() {
    const list = loadHistory();
    historySection.hidden = list.length === 0;
    historyList.innerHTML = '';
    list.forEach(({ shortUrl, longUrl }) => {
      const li = document.createElement('li');
      li.className = 'history-item';

      const textBox = document.createElement('div');
      textBox.className = 'history-text';
      const a = document.createElement('a');
      a.className = 'history-short';
      a.href = shortUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = shortUrl;
      const span = document.createElement('span');
      span.className = 'history-long';
      span.textContent = longUrl;
      span.title = longUrl;
      textBox.append(a, span);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'history-copy';
      btn.title = '복사';
      btn.setAttribute('aria-label', `${shortUrl} 복사`);
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
      btn.addEventListener('click', () => handleCopy(shortUrl));

      li.append(textBox, btn);
      historyList.appendChild(li);
    });
  }
  btnClearHistory.addEventListener('click', () => {
    saveHistory([]);
    renderHistory();
  });
  renderHistory();
})();
