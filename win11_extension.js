// ============================================================
//  Windows 11 Simulator - Premium Glassmorphism UI
//  ============================================================
(function(Scratch) {
  if (!Scratch.extensions.unsandboxed) {
    throw new Error("This extension must run unsandboxed.");
  }

  const API_BASE = 'https://web-production-18337.up.railway.app';
  let currentUser = localStorage.getItem('win11_user') || null;
  let virtualFS = [
    { id: '1', name: 'README.txt', type: 'file', content: 'Welcome to Windows 11 Simulator!', path: 'C:/Users/User/Desktop/' },
    { id: '2', name: 'Ideas.txt', type: 'file', content: '1. Build more apps\n2. Sync with cloud', path: 'C:/Users/User/Documents/' }
  ];

  // --- UI Constants ---
  const IC = {
    start: "🪟", search: "🔍", widgets: "🧱", folder: "📁", edge: "🌐", store: "🛍️",
    settings: "⚙️", cmd: "📟", notepad: "📝", calc: "🧮", terminal: "🐚",
    shutdown: "⏻", user: "👤", back: "⬅️", forward: "➡️", reload: "⟳",
  };

  // --- State ---
  let initialized = false;
  let darkMode = true;
  let accentColor = "#0078D4";
  let windows = [];
  let zIndexBase = 1000;
  let desktop, taskbar, startMenu, overlay;

  // --- Helpers ---
  const el = (tag, cls) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  };

  const btn = (cls, html, cb) => {
    const b = el("button", cls);
    b.innerHTML = html;
    if (cb) b.onclick = cb;
    return b;
  };

  // --- API ---
  async function apiRequest(endpoint, method = 'GET', body = null) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API_BASE}${endpoint}`, opts);
    return res.json();
  }

  async function syncFile(file) {
    if (!currentUser) return;
    await apiRequest(`/files/${currentUser}`, 'POST', file);
  }

  async function loadCloudFiles() {
    if (!currentUser) return;
    try {
      const files = await apiRequest(`/files/${currentUser}`);
      if (Array.isArray(files)) virtualFS = [...files];
    } catch (e) { console.error(e); }
  }

  // --- UI Construction ---
  function createDesktop() {
    overlay = el("div", "w11-overlay " + (darkMode ? "dark" : "light"));
    overlay.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      overflow: hidden; pointer-events: none; z-index: 100;
      --accent: ${accentColor};
    `;

    const style = el("style");
    style.innerHTML = `
      .w11-overlay * { box-sizing: border-box; font-family: 'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif; pointer-events: auto; }
      .w11-overlay { --bg: rgba(28, 28, 28, 0.7); --blur: 30px; --text: #fff; --border: rgba(255, 255, 255, 0.1); }
      .w11-overlay.light { --bg: rgba(243, 243, 243, 0.7); --text: #000; --border: rgba(0, 0, 0, 0.1); }
      
      .w11-taskbar {
        position: absolute; bottom: 0; left: 0; width: 100%; height: 48px;
        background: var(--bg); backdrop-filter: blur(var(--blur));
        border-top: 1px solid var(--border); display: flex; align-items: center; justify-content: center; z-index: 9999;
      }
      .w11-taskbar-center { display: flex; gap: 4px; }
      .w11-tb-btn {
        width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
        border: none; background: none; border-radius: 4px; cursor: pointer; transition: 0.2s; font-size: 20px;
      }
      .w11-tb-btn:hover { background: rgba(255,255,255,0.1); }
      .w11-tb-btn.active { position: relative; }
      .w11-tb-btn.active::after { content: ''; position: absolute; bottom: 2px; left: 25%; width: 50%; height: 3px; background: var(--accent); border-radius: 2px; }

      .w11-window {
        position: absolute; background: var(--bg); backdrop-filter: blur(var(--blur));
        border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        display: flex; flex-direction: column; overflow: hidden; animation: w11-fade-in 0.2s ease-out;
      }
      .w11-win-title {
        height: 32px; padding: 0 12px; display: flex; align-items: center; justify-content: space-between;
        background: rgba(0,0,0,0.05); user-select: none;
      }
      .w11-win-btns { display: flex; height: 100%; }
      .w11-win-btn { width: 46px; height: 32px; display: flex; align-items: center; justify-content: center; border: none; background: none; font-size: 14px; }
      .w11-win-btn:hover { background: rgba(255,255,255,0.1); }
      .w11-win-btn.close:hover { background: #e81123; color: white; }

      .w11-start-menu {
        position: absolute; bottom: 58px; left: 50%; transform: translateX(-50%) translateY(20px);
        width: 520px; height: 600px; background: var(--bg); backdrop-filter: blur(var(--blur));
        border: 1px solid var(--border); border-radius: 8px; visibility: hidden; opacity: 0; transition: 0.2s;
        padding: 30px; display: flex; flex-direction: column; z-index: 9998;
      }
      .w11-start-menu.open { visibility: visible; opacity: 1; transform: translateX(-50%) translateY(0); }
      
      .w11-explorer { height: 100%; display: flex; flex-direction: column; color: var(--text); }
      .w11-explorer-toolbar { display: flex; gap: 8px; padding: 8px; border-bottom: 1px solid var(--border); }
      .w11-explorer-body { display: flex; flex: 1; overflow: hidden; }
      .w11-explorer-sidebar { width: 160px; padding: 8px; border-right: 1px solid var(--border); overflow-y: auto; }
      .w11-explorer-main { flex: 1; padding: 16px; overflow-y: auto; }
      .w11-explorer-grid { display: grid; grid-template-columns: repeat(auto-fill, 80px); gap: 16px; }
      .w11-file { text-align: center; cursor: pointer; padding: 8px; border-radius: 4px; }
      .w11-file:hover { background: rgba(255,255,255,0.1); }
      .w11-file-icon { font-size: 32px; margin-bottom: 4px; }
      .w11-file-name { font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

      @keyframes w11-fade-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
    `;
    document.body.appendChild(style);
    document.body.appendChild(overlay);

    // --- Taskbar ---
    taskbar = el("div", "w11-taskbar");
    const tbCenter = el("div", "w11-taskbar-center");
    
    const apps = [
      { id: 'start', icon: IC.start, color: '#0078d4' },
      { id: 'search', icon: IC.search },
      { id: 'explorer', icon: IC.folder },
      { id: 'edge', icon: IC.edge },
      { id: 'store', icon: IC.store },
      { id: 'notepad', icon: IC.notepad },
      { id: 'calc', icon: IC.calc },
      { id: 'settings', icon: IC.settings }
    ];

    apps.forEach(app => {
      const b = btn("w11-tb-btn", app.icon, () => {
        if (app.id === 'start') toggleStart();
        else openApp(app.id);
      });
      if (app.id === 'start') b.style.color = app.color;
      tbCenter.appendChild(b);
    });
    taskbar.appendChild(tbCenter);
    overlay.appendChild(taskbar);

    // --- Start Menu ---
    startMenu = el("div", "w11-start-menu");
    startMenu.innerHTML = `
      <div style="flex:1">
        <div style="display:flex;justify-content:space-between;margin-bottom:20px;">
          <b style="font-size:14px">ピン留め済み</b>
          <button style="font-size:12px;background:none;border:none;color:var(--text);border:1px solid var(--border);border-radius:4px;padding:2px 8px;">すべて表示 ></button>
        </div>
        <div id="w11-start-grid" style="display:grid;grid-template-columns:repeat(6,1fr);gap:20px;text-align:center;">
          ${apps.slice(2).map(a => `<div onclick="openApp('${a.id}')" style="cursor:pointer;"><div style="font-size:24px">${a.icon}</div><div style="font-size:11px;margin-top:4px">${a.id}</div></div>`).join('')}
        </div>
      </div>
      <div style="height:64px;margin-top:20px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:0 10px;">
        <div style="display:flex;align-items:center;gap:12px;cursor:pointer;" onclick="showLoginUI()">
          <div style="width:32px;height:32px;background:var(--accent);border-radius:50%;display:flex;align-items:center;justify-content:center;">${IC.user}</div>
          <span style="font-size:12px">${currentUser || 'サインイン'}</span>
        </div>
        <button style="background:none;border:none;font-size:18px;color:var(--text);cursor:pointer;">${IC.shutdown}</button>
      </div>
    `;
    overlay.appendChild(startMenu);
  }

  function toggleStart() {
    startMenu.classList.toggle("open");
  }

  function openApp(id) {
    if (id === 'explorer') openExplorer();
    if (id === 'notepad') openNotepad();
    if (id === 'settings') openSettings();
    if (id === 'calc') openCalculator();
    if (id === 'edge') openEdge();
    startMenu.classList.remove("open");
  }

  function createWindow({ title, icon, content, width=600, height=400 }) {
    const win = el("div", "w11-window");
    win.style.width = width + "px";
    win.style.height = height + "px";
    win.style.left = (50 + windows.length * 20) + "px";
    win.style.top = (50 + windows.length * 20) + "px";
    win.style.zIndex = zIndexBase++;

    const titleBar = el("div", "w11-win-title");
    titleBar.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:500;">
        <span>${icon}</span><span>${title}</span>
      </div>
      <div class="w11-win-btns">
        <button class="w11-win-btn">－</button>
        <button class="w11-win-btn">▢</button>
        <button class="w11-win-btn close">✕</button>
      </div>
    `;
    
    titleBar.querySelector(".close").onclick = () => {
      win.remove();
      windows = windows.filter(w => w !== win);
    };

    // Drag support
    let isDragging = false;
    let offsetX, offsetY;
    titleBar.onmousedown = (e) => {
      isDragging = true;
      offsetX = e.clientX - win.offsetLeft;
      offsetY = e.clientY - win.offsetTop;
      win.style.zIndex = zIndexBase++;
    };
    window.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      win.style.left = (e.clientX - offsetX) + "px";
      win.style.top = (e.clientY - offsetY) + "px";
    });
    window.addEventListener("mouseup", () => isDragging = false);

    const body = el("div", "w11-win-body");
    body.style.flex = "1";
    body.style.overflow = "hidden";
    body.appendChild(content);
    win.appendChild(titleBar);
    win.appendChild(body);
    overlay.appendChild(win);
    windows.push(win);
  }

  // --- Explorer ---
  function openExplorer() {
    const container = el("div", "w11-explorer");
    const grid = el("div", "w11-explorer-grid");
    
    const refreshGrid = () => {
      grid.innerHTML = "";
      virtualFS.forEach(file => {
        const f = el("div", "w11-file");
        f.innerHTML = `<div class="w11-file-icon">${file.type === 'folder' ? '📁' : '📄'}</div><div class="w11-file-name">${file.name}</div>`;
        f.ondblclick = () => {
          if (file.type === 'file') openNotepad(file.content, file.name);
        };
        grid.appendChild(f);
      });
    };

    const toolbar = el("div", "w11-explorer-toolbar");
    toolbar.innerHTML = `
      <button style="background:none;border:none;color:var(--text);padding:4px 8px;border-radius:4px;cursor:pointer;border:1px solid var(--border);">＋ 新規作成</button>
    `;
    toolbar.querySelector("button").onclick = async () => {
      const name = prompt("ファイル名:", "memo.txt");
      if (name) {
        const newFile = { id: Date.now().toString(), name, type: 'file', content: '', path: 'C:/Users/User/Documents/' };
        virtualFS.push(newFile);
        await syncFile(newFile);
        refreshGrid();
      }
    };

    const body = el("div", "w11-explorer-body");
    const sidebar = el("div", "w11-explorer-sidebar");
    sidebar.innerHTML = `<div style="font-size:12px;padding:4px;">🏠 ホーム</div><div style="font-size:12px;padding:4px;">🖥️ デスクトップ</div><div style="font-size:12px;padding:4px;background:rgba(255,255,255,0.1);border-radius:4px;">📄 ドキュメント</div>`;
    body.appendChild(sidebar);

    const main = el("div", "w11-explorer-main");
    main.appendChild(grid);
    body.appendChild(main);
    container.appendChild(toolbar);
    container.appendChild(body);

    refreshGrid();
    createWindow({ title: "エクスプローラー", icon: IC.folder, content: container });
  }

  // --- Notepad ---
  function openNotepad(initialContent="", name="無題.txt") {
    const container = el("div");
    container.style.height = "100%";
    const area = el("textarea");
    area.style.cssText = "width:100%;height:100%;background:none;border:none;color:var(--text);padding:10px;resize:none;outline:none;font-family:monospace;";
    area.value = initialContent;
    
    container.onkeydown = async (e) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        const file = virtualFS.find(f => f.name === name) || { name, type: 'file', path: 'C:/Users/User/Documents/' };
        file.content = area.value;
        await syncFile(file);
        alert("クラウドに保存しました！");
      }
    };

    container.appendChild(area);
    createWindow({ title: "メモ帳 - " + name, icon: IC.notepad, content: container, width: 500, height: 400 });
  }

  // --- Settings ---
  function openSettings() {
    const container = el("div");
    container.style.padding = "20px";
    container.innerHTML = `
      <h2 style="margin-bottom:20px;font-size:18px;">背景の変更</h2>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">
        ${[1,2,3,4].map(i => `<div onclick="changeWP(${i})" style="aspect-ratio:16/9;background:#333;border-radius:4px;cursor:pointer;border:2px solid var(--border);background-size:cover;background-position:center;display:flex;align-items:center;justify-content:center;font-size:12px;">壁紙 ${i}</div>`).join('')}
      </div>
    `;
    window.changeWP = (i) => {
      try {
        const vm = window.vm || Scratch.vm;
        const stage = vm.runtime.getTargetForStage();
        stage.setCostume(i-1);
      } catch(e) {}
    };
    createWindow({ title: "設定", icon: IC.settings, content: container, width: 400, height: 500 });
  }

  // --- Auth UI ---
  function showLoginUI() {
    const div = el("div", "w11-login-screen");
    div.style = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);backdrop-filter:blur(30px);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;`;
    div.innerHTML = `
      <img src="https://img.icons8.com/fluency/96/user-male-circle.png" style="margin-bottom:20px;">
      <h2 style="margin-bottom:25px;">Windows 11 Sign-in</h2>
      <input id="u" placeholder="User" style="width:250px;padding:10px;margin-bottom:10px;border-radius:4px;border:none;background:rgba(255,255,255,0.1);color:white;">
      <input id="p" type="password" placeholder="Pass" style="width:250px;padding:10px;margin-bottom:20px;border-radius:4px;border:none;background:rgba(255,255,255,0.1);color:white;">
      <button id="l" style="width:250px;padding:10px;background:var(--accent);color:white;border:none;border-radius:4px;cursor:pointer;">Login</button>
      <button id="r" style="margin-top:10px;background:none;border:none;color:#aaa;cursor:pointer;">Register</button>
    `;
    document.body.appendChild(div);
    div.querySelector('#l').onclick = async () => {
      const username = div.querySelector('#u').value;
      const password = div.querySelector('#p').value;
      const res = await apiRequest('/auth/login', 'POST', {username, password});
      if (res.status === 'success') {
        currentUser = username;
        localStorage.setItem('win11_user', username);
        div.remove();
        await loadCloudFiles();
      }
    };
    div.querySelector('#r').onclick = async () => {
      const username = div.querySelector('#u').value;
      const password = div.querySelector('#p').value;
      await apiRequest('/auth/register', 'POST', {username, password});
      alert("Registered!");
    };
  }

  // --- Extension Class ---
  class Win11Extension {
    getInfo() {
      return {
        id: "win11",
        name: "Windows 11 Simulator",
        blocks: [{ opcode: "init", blockType: Scratch.BlockType.COMMAND, text: "Windowsを起動" }]
      };
    }
    init() {
      if (!initialized) {
        createDesktop();
        initialized = true;
        if (currentUser) loadCloudFiles();
        else showLoginUI();
      }
    }
  }

  Scratch.extensions.register(new Win11Extension());
})(Scratch);
