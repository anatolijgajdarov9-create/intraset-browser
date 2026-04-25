import { useMemo } from 'react';

export const READER_STYLE_LINES = [
  'html,body{background:#fffff8!important;color:#1a1a1a!important}',
  'body{max-width:680px!important;margin:0 auto!important;padding:20px!important;font-family:Georgia,serif!important;font-size:18px!important;line-height:1.8!important}',
  'nav,header,footer,aside,[class*="nav"],[class*="menu"],[class*="sidebar"],[class*="ad"],[class*="banner"],[id*="nav"],[id*="header"],[id*="footer"],[id*="sidebar"]{display:none!important}',
  'img,video{max-width:100%!important;height:auto!important}',
  'a{color:#2563eb!important}',
];

// ─── Статичные скрипты ──────────────────────────────────────────────────────

export const forceLightBeforeScript = `
  (function(){
    try {
      var m = document.createElement('meta');
      m.name = 'color-scheme';
      m.content = 'light';
      document.head.appendChild(m);
    } catch(e) {}
    try {
      var _mm = window.matchMedia.bind(window);
      window.matchMedia = function(q) {
        if (q && q.indexOf('prefers-color-scheme') !== -1) {
          return {
            matches: q.indexOf('dark') === -1,
            media: q,
            onchange: null,
            addListener: function() {},
            removeListener: function() {},
            addEventListener: function() {},
            removeEventListener: function() {},
            dispatchEvent: function() { return false; },
          };
        }
        return _mm(q);
      };
    } catch(e) {}
  })(); true;
`;

export const nightModeOnScript = `(function(){
  var el = document.getElementById('__intra_night__');
  if (!el) { el = document.createElement('style'); el.id = '__intra_night__'; document.head.appendChild(el); }
  el.textContent = 'html{filter:invert(1) hue-rotate(180deg)!important;}img,video,canvas,svg,iframe{filter:invert(1) hue-rotate(180deg)!important;}';
})(); true;`;

export const nightModeOffScript = `(function(){
  var el = document.getElementById('__intra_night__');
  if (el) el.remove();
})(); true;`;

const COLOR_SCHEME_FIX = `(function(){
  var m = document.querySelector('meta[name="color-scheme"]');
  if (m) m.content = 'light';
})(); true;`;

const DOWNLOAD_INTERCEPT = `(function(){
  document.addEventListener('click', function(e){
    var a = e.target.closest('a[download], a[href$=".pdf"], a[href$=".zip"], a[href$=".apk"], a[href$=".doc"], a[href$=".docx"], a[href$=".xls"], a[href$=".xlsx"], a[href$=".mp3"], a[href$=".mp4"]');
    if (!a || !a.href) return;
    if (a.hasAttribute('download') || /\\.(pdf|zip|apk|doc|docx|xls|xlsx|mp3|mp4|avi|mkv|mov|wav|flac|rar|7z|csv|ppt|pptx|dmg|exe|deb)$/i.test(a.pathname || '')) {
      e.preventDefault();
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: '__download',
        url: a.href,
        filename: a.download || '',
      }));
    }
  }, true);
})(); true;`;

const EXTRACT_FAVICON = `
  (function() {
    var favicon = document.querySelector('link[rel="icon"]') ||
                  document.querySelector('link[rel="shortcut icon"]') ||
                  document.querySelector('link[rel="apple-touch-icon"]');
    var faviconUrl = favicon ? (favicon.href || favicon.getAttribute('href')) : null;
    if (!faviconUrl) faviconUrl = window.location.origin + '/favicon.ico';
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'favicon', favicon: faviconUrl }));
    true;
  })();
`;

const DIALOG_INTERCEPT = `(function(){
  window.alert = function(msg) {
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'__dialog',kind:'alert',msg:String(msg||'')}));
  };
  window.confirm = function(msg) {
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'__dialog',kind:'confirm',msg:String(msg||'')}));
    return true;
  };
  window.prompt = function(msg, def) {
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'__dialog',kind:'prompt',msg:String(msg||'')}));
    return null;
  };
})(); true;`;

const LINK_LONG_PRESS = `(function(){
  var _lpt;
  document.addEventListener('touchstart', function(e){
    var a   = e.target.closest('a[href]');
    var img = e.target.closest('img[src]');
    if (!a && !img) return;
    _lpt = setTimeout(function(){
      var payload;
      if (img && img.src) {
        payload = {
          type: '__linkContext',
          elementType: 'image',
          url: img.src,
        };
      } else {
        payload = {
          type: '__linkContext',
          elementType: 'link',
          url: a.href,
          text: (a.innerText || a.textContent || '').trim().substring(0, 80),
        };
      }
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }, 500);
  }, {passive:true});
  document.addEventListener('touchend',  function(){ clearTimeout(_lpt); }, {passive:true});
  document.addEventListener('touchmove', function(){ clearTimeout(_lpt); }, {passive:true});
})(); true;`;

// ─── Хук ────────────────────────────────────────────────────────────────────

export function useWebViewScripts({ currentZoom, isReadingMode, isNightMode }) {
  const injectedJavaScript = useMemo(() => {
    const parts = [
      COLOR_SCHEME_FIX,
      DOWNLOAD_INTERCEPT,
      EXTRACT_FAVICON,
      DIALOG_INTERCEPT,
      LINK_LONG_PRESS,
    ];
    if (isNightMode) parts.push(nightModeOnScript);
    if (currentZoom !== 100) {
      parts.push(
        `(function(){document.body.style.zoom='${currentZoom}%';document.documentElement.style.zoom='${currentZoom}%';})(); true;`
      );
    }
    if (isReadingMode) {
      parts.push(
        `(function(){var s=document.createElement('style');s.id='__intra_reader__';s.textContent=${JSON.stringify(READER_STYLE_LINES.join('\n'))};document.head.appendChild(s);})(); true;`
      );
    }
    return parts.join('\n');
  }, [isNightMode, currentZoom, isReadingMode]);

  return { forceLightBeforeScript, injectedJavaScript };
}
