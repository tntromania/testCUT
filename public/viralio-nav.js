/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  viralio-nav.js — Premium Floating Navigation Bar            ║
 * ║  Drop into any Viralio sub-app. Configure below.             ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

(function () {
  'use strict';

  // ── App Registry ──────────────────────────────────────────────
  const APPS = [
    {
      key: 'video', name: 'Video', url: 'https://downloader.viralio.ro/',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="15" height="13" rx="2"/><polygon points="17 8 22 5 22 19 17 16"/></svg>`
    },
    {
      key: 'audiocut', name: 'AudioCut', url: 'https://audiocut.viralio.ro',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>`
    },
    {
      key: 'captions', name: 'Captions', url: 'https://captions.viralio.ro',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 15h3m7 0h-4M7 11h3m7 0h-7"/></svg>`
    },
    {
      key: 'voice', name: 'Voice', url: 'https://voice.viralio.ro',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`
    },
    {
      key: 'pipeline', name: 'Pipeline', url: 'https://pipeline.viralio.ro',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><path d="M11 18H8a2 2 0 0 1-2-2V9"/></svg>`
    },
    {
      key: 'media', name: 'Media', url: 'https://video.viralio.ro/',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`
    },
  ];

  const cfg = window.VIRALIO_NAV_CONFIG || {};
  const CURRENT_APP_KEY = cfg.currentApp || 'video';

  let _onLoginCb  = null;
  let _onLogoutCb = null;

  // ── Import Fonturi: Syne + DM Sans ────────────────
  if (!document.querySelector('#vn-fonts')) {
    const lnk = document.createElement('link');
    lnk.id = 'vn-fonts'; lnk.rel = 'stylesheet';
    lnk.href = 'https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@500;700&display=swap';
    document.head.appendChild(lnk);
  }

  // ── CSS ───────────────────────────────────────────────
  const CSS = `
    #vn-root {
      position: sticky; 
      top: 12px; 
      z-index: 99999;
      display: flex; justify-content: center;
      padding: 0 16px; 
      margin-bottom: 16px; 
      pointer-events: none;
      /* DM Sans este acum fontul de bază pentru UI */
      font-family: 'DM Sans', sans-serif;
    }
    
    #vn-bar {
      pointer-events: auto;
      width: 100%; max-width: 1000px; height: 56px;
      
      background: rgba(255, 255, 255, 1.00);
      border: 1px solid rgba(15, 23, 42, 0.06);
      border-radius: 100px;
      box-shadow: none;
      backdrop-filter: blur(12px) saturate(180%);
      -webkit-backdrop-filter: blur(12px) saturate(180%);
      
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      padding: 0 8px; 
      
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      animation: vn-fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }

    #vn-bar.scrolled {
      background: rgba(255, 255, 255, 0.35); 
      border: 1px solid rgba(15, 23, 42, 0.08);
      box-shadow: 0 10px 30px -10px rgba(15, 23, 42, 0.1), 0 0 1px rgba(15,23,42,0.05);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
    }

    @keyframes vn-fade-in { from { opacity: 0; transform: translateY(-15px); } to { opacity: 1; transform: translateY(0); } }

    .vn-side-left { display: flex; align-items: center; justify-content: flex-start; padding-left: 8px; }
    .vn-side-right { display: flex; align-items: center; justify-content: flex-end; }

    /* --- LOGO: Syne --- */
    #vn-logo { 
      display: flex; align-items: center; gap: 8px; text-decoration: none; 
    }
    
    #vn-logo-icon-wrap {
      position: relative;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    #vn-logo-glow {
      position: absolute;
      inset: 0px; 
      background: #6d28d9;
      border-radius: 8px; 
      filter: blur(5px); 
      z-index: -1;
      animation: vn-glow-pulse 4s ease-in-out infinite;
    }

    @keyframes vn-glow-pulse {
      0%, 100% { opacity: 0.2; transform: scale(0.95); }
      50% { opacity: 0.45; transform: scale(1.05); }
    }

    #vn-custom-logo { 
      width: 32px; height: 32px; border-radius: 8px; object-fit: contain; 
      position: relative;
      z-index: 1;
    }

    #vn-logo-text { 
      font-family: 'Syne', sans-serif; 
      font-weight: 800; 
      font-size: 20px; /* Syne e mai lat, 20px e perfect */
      letter-spacing: -0.5px; 
      
      background: linear-gradient(90deg, #1e293b 0%, #7c3aed 50%, #334155 100%);
      background-size: 200% auto;
      color: transparent;
      -webkit-background-clip: text;
      background-clip: text;
      
      animation: vn-text-flow 4s linear infinite;
    }

    @keyframes vn-text-flow {
      to { background-position: 200% center; }
    }
    /* ------------------------------------------------ */

    /* Apps: DM Sans - Curat, lizibil */
    #vn-apps {
      display: flex; align-items: center; justify-content: center; gap: 4px;
      overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none;
    }
    #vn-apps::-webkit-scrollbar { display: none; }
    
    .vn-app {
      display: flex; align-items: center; gap: 6px; padding: 8px 14px;
      border-radius: 100px; text-decoration: none; 
      
      /* AICI ESTE FONTUL NOU PENTRU APLICAȚII */
      font-family: 'DM Sans', sans-serif;
      font-size: 14px; 
      font-weight: 700; /* Bold */
      letter-spacing: -0.2px; 
      
      color: #64748b; transition: all 0.2s ease; white-space: nowrap;
    }
    .vn-app svg { width: 16px; height: 16px; flex-shrink: 0; opacity: 0.8; }
    .vn-app:hover { background: rgba(15,23,42,0.06); color: #0f172a; }
    
    .vn-app.active { background: #ffffff; color: #6d28d9; box-shadow: 0 2px 6px rgba(0,0,0,0.06); pointer-events: none; border: 1px solid rgba(15,23,42,0.04); }

    /* Responsivitate pentru ecrane mici */
    @media (max-width: 900px) {
      #vn-logo-text { display: none; }
      .vn-app span { display: none; }
      .vn-app.active span { display: inline; }
      .vn-app { padding: 8px; }
      .vn-app.active { padding: 8px 14px; }
    }
    @media (max-width: 500px) {
      #vn-root { padding: 0 12px; top: 8px; margin-bottom: 24px; }
      #vn-bar { height: 52px; padding: 0 6px; }
    }

    /* Auth: DM Sans - Bold */
    #vn-btn-login {
      font-family: 'DM Sans', sans-serif;
      font-size: 14px; 
      font-weight: 700; 
      letter-spacing: -0.2px;
      
      background: #0f172a; color: white; border: none; padding: 8px 18px;
      border-radius: 100px;
      cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 4px rgba(15,23,42,0.1);
    }
    #vn-btn-login:hover { background: #6d28d9; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(109, 40, 217, 0.25); }

    #vn-user {
      display: none; align-items: center; gap: 8px; padding: 4px 4px 4px 12px;
      background: white; border: 1px solid rgba(15,23,42,0.08); border-radius: 100px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    #vn-user.visible { display: flex; }
    #vn-user-details { display: flex; flex-direction: column; line-height: 1.2; justify-content: center; }
    
    /* Nume user */
    #vn-user-name { font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: -0.2px; color: #0f172a; max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: right; }
    
    /* Credite user */
    #vn-user-credits { font-size: 11px; font-weight: 700; color: #6d28d9; text-align: right; }
    #vn-user-avatar { width: 28px; height: 28px; border-radius: 50%; border: 1.5px solid rgba(15,23,42,0.05); object-fit: cover; }
    
    #vn-btn-logout {
      background: none; border: none; width: 28px; height: 28px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center; color: #64748b;
      cursor: pointer; transition: 0.2s;
    }
    #vn-btn-logout:hover { background: #fee2e2; color: #ef4444; }
    #vn-btn-logout svg { width: 14px; height: 14px; }
  `;

  function injectStyles() {
    if (document.getElementById('vn-styles')) return;
    const s = document.createElement('style');
    s.id = 'vn-styles'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  function mount() {
    injectStyles();

    const root = document.createElement('div');
    root.id = 'vn-root';

    let appsHtml = '';
    APPS.forEach(app => {
      const isActive = app.key === CURRENT_APP_KEY;
      const tag = isActive ? 'div' : 'a';
      const href = isActive ? '' : `href="${app.url}"`;
      appsHtml += `
        <${tag} ${href} class="vn-app ${isActive ? 'active' : ''}">
          ${app.icon} <span>${app.name}</span>
        </${tag}>
      `;
    });

    root.innerHTML = `
      <div id="vn-bar">
        <!-- Partea stângă: Logo -->
        <div class="vn-side-left">
          <a id="vn-logo" href="https://viralio.ro">
            <div id="vn-logo-icon-wrap">
              <div id="vn-logo-glow"></div>
              <img src="/android-chrome-512x512.png" alt="Viralio" id="vn-custom-logo">
            </div>
            <span id="vn-logo-text">Viralio</span>
          </a>
        </div>
        
        <!-- Partea centrală: Aplicații -->
        <nav id="vn-apps">${appsHtml}</nav>
        
        <!-- Partea dreaptă: Autentificare -->
        <div class="vn-side-right" id="vn-auth">
          <button id="vn-btn-login">Conectează-te</button>
          <div id="vn-user">
            <div id="vn-user-details">
              <span id="vn-user-name"></span>
              <span id="vn-user-credits">0 Credite</span>
            </div>
            <img id="vn-user-avatar" src="" alt="Avatar" style="display:none;">
            <button id="vn-btn-logout" title="Deconectare">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertBefore(root, document.body.firstChild);

    const barElement = document.getElementById('vn-bar');
    window.addEventListener('scroll', () => {
      if (window.scrollY > 15) {
        barElement.classList.add('scrolled');
      } else {
        barElement.classList.remove('scrolled');
      }
    });

    document.getElementById('vn-btn-login').addEventListener('click',  () => { if (_onLoginCb)  _onLoginCb();  });
    document.getElementById('vn-btn-logout').addEventListener('click', () => { if (_onLogoutCb) _onLogoutCb(); });
  }

  window.ViralioNav = {
    setUser({ name, avatar, credits }) {
      const loginBtn = document.getElementById('vn-btn-login');
      const userPill = document.getElementById('vn-user');
      if (!loginBtn || !userPill) return;
      loginBtn.style.display = 'none';
      userPill.classList.add('visible');
      document.getElementById('vn-user-name').textContent = name || '';
      const av = document.getElementById('vn-user-avatar');
      if (avatar) { av.src = avatar; av.style.display = 'block'; }
      document.getElementById('vn-user-credits').textContent = `${credits ?? 0} Credite`;
    },
    clearUser() {
      const loginBtn = document.getElementById('vn-btn-login');
      const userPill = document.getElementById('vn-user');
      if (!loginBtn || !userPill) return;
      loginBtn.style.display = 'block';
      userPill.classList.remove('visible');
    },
    setCredits(amount) {
      const el = document.getElementById('vn-user-credits');
      if (el) el.textContent = `${amount} Credite`;
    },
    onLogin(cb)  { _onLoginCb  = cb; },
    onLogout(cb) { _onLogoutCb = cb; },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

})();
