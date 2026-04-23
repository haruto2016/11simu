// ============================================================
//  Windows 11 Simulator - Complete System (Sandboxed Ready)
// ============================================================
(function(Scratch) {
  // DOMアクセスが必要なため、自動的にUnsandboxedを要求
  if (!Scratch.extensions.unsandboxed) {
    console.warn("Win11 Simulator works best in Unsandboxed mode.");
  }

  const API_BASE = 'https://web-production-18337.up.railway.app';
  let currentUser = localStorage.getItem('win11_user') || null;
  let virtualFS = []; // Cloud files will be loaded here

  const IC = {
    start: "🪟", search: "🔍", folder: "📁", edge: "🌐", store: "🛍️",
    settings: "⚙️", notepad: "📝", calc: "🧮", terminal: "🐚",
    shutdown: "⏻", user: "👤", back: "⬅️", forward: "➡️", reload: "⟳",
  };

  let initialized = false;
  let windows = [];
  let zIndexBase = 1000;
  let overlay, startMenu, taskbar;

  const el = (tag, cls) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  };

  // --- API Helpers ---
  async function apiRequest(endpoint, method = 'GET', body = null) {
    try {
      const opts = { method, headers: { 'Content-Type': 'application/json' } };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(`${API_BASE}${endpoint}`, opts);
      return res.json();
    } catch(e) { return { status: 'error', message: 'Offline' }; }
  }

  async function syncFile(file) {
    if (!currentUser) return;
    await apiRequest(`/files/${currentUser}`, 'POST', file);
  }

  async function loadCloudFiles() {
    if (!currentUser) return;
    const files = await apiRequest(`/files/${currentUser}`);
    if (Array.isArray(files)) virtualFS = files;
  }

  // --- UI System ---
  function createDesktop() {
    if (document.getElementById('w11-overlay')) return;
    
    overlay = el("div", "w11-overlay");
    overlay.id = 'w11-overlay';
    overlay.style.cssText = `
      position: absolute; top:0; left:0; width:100%; height:100%;
      overflow: hidden; pointer-events: none; z-index: 100;
      font-family: 'Segoe UI Variable', system-ui, sans-serif;
    `;

    const style = el("style");
    style.innerHTML = `
      .w11-overlay * { box-sizing: border-box; pointer-events: auto; }
      .w11-taskbar {
        position: absolute; bottom:0; left:0; width:100%; height:48px;
        background: rgba(28,28,28,0.75); backdrop-filter: blur(20px);
        border-top: 1px solid rgba(255,255,255,0.1); display:flex; justify-content:center; align-items:center; z-index: 9999;
      }
      .w11-tb-btn {
        width: 40px; height:40px; border:none; background:none; border-radius:4px;
        display:flex; align-items:center; justify-content:center; font-size:20px; transition: 0.1s; cursor:pointer;
      }
      .w11-tb-btn:hover { background: rgba(255,255,255,0.1); }
      
      .w11-window {
        position: absolute; background: rgba(32,32,32,0.85); backdrop-filter: blur(30px);
        border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); overflow:hidden;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5); display:flex; flex-direction:column;
        animation: w11-open 0.2s ease-out;
      }
      .w11-win-title {
        height: 32px; padding: 0 12px; display:flex; align-items:center; justify-content:space-between;
        background: rgba(0,0,0,0.1); user-select:none; font-size:12px; color:white;
      }
      .w11-win-btns { display:flex; height:100%; }
      .w11-win-btn { width:46px; height:32px; display:flex; align-items:center; justify-content:center; border:none; background:none; color:white; }
      .w11-win-btn:hover { background: rgba(255,255,255,0.1); }
      .w11-win-btn.close:hover { background: #e81123; }

      .w11-start-menu {
        position: absolute; bottom: 58px; left: 50%; transform: translateX(-50%) translateY(20px);
        width: 520px; height: 600px; background: rgba(32,32,32,0.8); backdrop-filter: blur(40px);
        border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; visibility: hidden; opacity: 0;
        transition: 0.2s; z-index: 9998; padding: 24px; color: white; display: flex; flex-direction: column;
      }
      .w11-start-menu.open { visibility: visible; opacity: 1; transform: translateX(-50%) translateY(0); }

      @keyframes w11-open { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
    `;
    document.body.appendChild(style);
    document.body.appendChild(overlay);

    // Taskbar
    taskbar = el("div", "w11-taskbar");
    const apps = [
      { id: 'start', icon: IC.start, color: '#0078d4' },
      { id: 'explorer', icon: IC.folder },
      { id: 'edge', icon: IC.edge },
      { id: 'notepad', icon: IC.notepad },
      { id: 'calc', icon: IC.calc },
      { id: 'settings', icon: IC.settings }
    ];
    apps.forEach(a => {
      const b = el("button", "w11-tb-btn");
      b.innerHTML = a.icon;
      if (a.color) b.style.color = a.color;
      b.onclick = () => (a.id === 'start' ? toggleStart() : openApp(a.id));
      taskbar.appendChild(b);
    });
    overlay.appendChild(taskbar);

    // Start Menu
    startMenu = el("div", "w11-start-menu");
    startMenu.innerHTML = `
      <div style="flex:1">
        <div style="display:flex; justify-content:space-between; margin-bottom:20px;">
          <b>ピン留め済み</b>
        </div>
        <div style="display:grid; grid-template-columns: repeat(6, 1fr); gap:16px; text-align:center;">
          ${apps.slice(1).map(a => `<div onclick="openApp('${a.id}')" style="cursor:pointer;"><div style="font-size:24px">${a.icon}</div><div style="font-size:10px">${a.id}</div></div>`).join('')}
        </div>
      </div>
      <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top:20px; display:flex; align-items:center; justify-content:space-between;">
        <div onclick="showLoginUI()" style="display:flex; align-items:center; gap:10px; cursor:pointer;">
          <div style="width:32px; height:32px; background:#0078d4; border-radius:50%; display:flex; align-items:center; justify-content:center;">${IC.user}</div>
          <span style="font-size:13px">${currentUser || 'サインイン'}</span>
        </div>
        <div style="font-size:18px; cursor:pointer;">${IC.shutdown}</div>
      </div>
    `;
    overlay.appendChild(startMenu);
  }

  function toggleStart() { startMenu.classList.toggle("open"); }

  function openApp(id) {
    startMenu.classList.remove("open");
    if (id === 'edge') openEdge();
    else if (id === 'explorer') openExplorer();
    else if (id === 'notepad') openNotepad();
    else if (id === 'calc') openCalc();
    else if (id === 'settings') openSettings();
  }

  function createWindow({ title, icon, content, width=640, height=440 }) {
    const win = el("div", "w11-window");
    win.style.width = width + "px";
    win.style.height = height + "px";
    win.style.left = (80 + windows.length * 20) + "px";
    win.style.top = (40 + windows.length * 20) + "px";
    win.style.zIndex = zIndexBase++;

    const titleBar = el("div", "w11-win-title");
    titleBar.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;"><span>${icon}</span><span>${title}</span></div>
      <div class="w11-win-btns">
        <button class="w11-win-btn">－</button>
        <button class="w11-win-btn">▢</button>
        <button class="w11-win-btn close">✕</button>
      </div>
    `;
    titleBar.querySelector(".close").onclick = () => { win.remove(); windows = windows.filter(w => w !== win); };

    // Simple Drag
    let isDragging = false, startX, startY;
    titleBar.onmousedown = (e) => { isDragging = true; startX = e.clientX - win.offsetLeft; startY = e.clientY - win.offsetTop; win.style.zIndex = zIndexBase++; };
    window.addEventListener("mousemove", (e) => { if(!isDragging) return; win.style.left = (e.clientX - startX) + "px"; win.style.top = (e.clientY - startY) + "px"; });
    window.addEventListener("mouseup", () => isDragging = false);

    const body = el("div");
    body.style.flex = "1"; body.style.overflow = "hidden";
    body.appendChild(content);
    win.appendChild(titleBar); win.appendChild(body);
    overlay.appendChild(win); windows.push(win);
  }

  // --- App: Edge Browser ---
  function openEdge() {
    const container = el("div");
    container.style.cssText = "height:100%; display:flex; flex-direction:column; background:white;";
    const toolbar = el("div");
    toolbar.style.cssText = "height:40px; background:#f3f3f3; display:flex; align-items:center; padding:0 10px; gap:10px; border-bottom:1px solid #ddd;";
    toolbar.innerHTML = `
      <div style="display:flex; gap:8px;"><span>${IC.back}</span><span>${IC.forward}</span><span>${IC.reload}</span></div>
      <input id="edge-url" value="https://www.google.com" style="flex:1; padding:4px 10px; border-radius:20px; border:1px solid #ccc; font-size:12px;">
    `;
    const iframe = el("iframe");
    iframe.src = "https://www.google.com/search?igu=1"; // igu=1 allows some embedding
    iframe.style.cssText = "flex:1; border:none; background:white;";

    const inp = toolbar.querySelector('#edge-url');
    inp.onkeydown = (e) => {
      if(e.key === 'Enter') {
        let url = inp.value;
        if(!url.startsWith('http')) url = 'https://' + url;
        iframe.src = url;
      }
    };

    container.appendChild(toolbar); container.appendChild(iframe);
    createWindow({ title: "Microsoft Edge", icon: IC.edge, content: container });
  }

  // --- App: Calculator ---
  function openCalc() {
    const container = el("div");
    container.style.cssText = "height:100%; color:white; padding:15px; display:flex; flex-direction:column;";
    const display = el("div");
    display.style.cssText = "font-size:32px; text-align:right; margin-bottom:20px; min-height:1.2em;";
    display.innerText = "0";
    const grid = el("div");
    grid.style.cssText = "display:grid; grid-template-columns: repeat(4, 1fr); gap:4px; flex:1;";
    
    let current = "";
    const btns = ["C","÷","×","⌫","7","8","9","-","4","5","6","+","1","2","3","=","±","0",".",""];
    btns.forEach(b => {
      const btn = el("button");
      btn.innerText = b;
      btn.style.cssText = "border:none; background:rgba(255,255,255,0.1); color:white; border-radius:4px; font-size:16px; cursor:pointer;";
      btn.onclick = () => {
        if(b === "=") { try { display.innerText = eval(current.replace('×','*').replace('÷','/')); current = display.innerText; } catch(e){ display.innerText='Error'; } }
        else if(b === "C") { current = ""; display.innerText = "0"; }
        else if(b === "⌫") { current = current.slice(0,-1); display.innerText = current || "0"; }
        else { current += b; display.innerText = current; }
      };
      if(b) grid.appendChild(btn); else grid.appendChild(el("div"));
    });
    container.appendChild(display); container.appendChild(grid);
    createWindow({ title: "電卓", icon: IC.calc, content: container, width: 300, height: 450 });
  }

  // --- App: Explorer ---
  function openExplorer() {
    const container = el("div"); container.style.cssText = "height:100%; display:flex; color:white;";
    const main = el("div"); main.style.cssText = "flex:1; padding:20px; display:grid; grid-template-columns: repeat(auto-fill, 80px); gap:20px; align-content:start;";
    
    const refresh = () => {
      main.innerHTML = "";
      virtualFS.forEach(f => {
        const item = el("div"); item.style.cssText = "text-align:center; cursor:pointer; width:80px; overflow:hidden;";
        item.innerHTML = `<div style="font-size:32px;">📄</div><div style="font-size:11px; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${f.name}</div>`;
        item.ondblclick = () => openNotepad(f.content, f.name);
        main.appendChild(item);
      });
    };
    container.appendChild(main);
    refresh();
    createWindow({ title: "エクスプローラー", icon: IC.folder, content: container });
  }

  // --- App: Notepad ---
  function openNotepad(val="", name="無題.txt") {
    const area = el("textarea");
    area.style.cssText = "width:100%; height:100%; background:none; border:none; color:white; padding:15px; outline:none; resize:none; font-family:monospace;";
    area.value = val;
    area.onkeydown = async (e) => {
      if(e.ctrlKey && e.key === 's') { e.preventDefault(); await syncFile({name, content: area.value, type:'file'}); alert("クラウド保存完了"); }
    };
    createWindow({ title: name + " - メモ帳", icon: IC.notepad, content: area });
  }

  // --- App: Settings ---
  function openSettings() {
    const div = el("div"); div.style.padding = "20px"; div.innerHTML = `<h3 style="color:white">壁紙の変更</h3><div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">${[1,2,3,4].map(i=>`<div onclick="cw(${i})" style="aspect-ratio:16/9; background:#444; border:1px solid #666; border-radius:4px; display:flex; align-items:center; justify-content:center; color:white; cursor:pointer;">壁紙 ${i}</div>`).join('')}</div>`;
    window.cw = (i) => { const vm = window.vm || Scratch.vm; const s = vm.runtime.getTargetForStage(); if(s) s.setCostume(i-1); };
    createWindow({ title: "設定", icon: IC.settings, content: div, width: 400, height: 400 });
  }

  // --- Auth UI ---
  function showLoginUI() {
    const div = el("div");
    div.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); backdrop-filter:blur(30px); z-index:99999; display:flex; align-items:center; justify-content:center; color:white;";
    div.innerHTML = `<div style="background:rgba(255,255,255,0.05); padding:40px; border-radius:12px; border:1px solid rgba(255,255,255,0.1); text-align:center; width:340px;"><img src="https://img.icons8.com/fluency/96/user-male-circle.png" style="width:80px; margin-bottom:20px;"><h2>Windows 11</h2><input id="u" placeholder="User" style="width:100%; padding:10px; margin-bottom:10px; border-radius:5px; border:none; background:rgba(0,0,0,0.2); color:white;"><input id="p" type="password" placeholder="Pass" style="width:100%; padding:10px; margin-bottom:20px; border-radius:5px; border:none; background:rgba(0,0,0,0.2); color:white;"><button id="bl" style="width:100%; padding:10px; background:#0078d4; border:none; border-radius:5px; color:white; cursor:pointer;">Sign in</button><br><button id="br" style="margin-top:15px; background:none; border:none; color:#aaa; cursor:pointer;">Register</button><p id="am" style="margin-top:20px; font-size:12px;"></p></div>`;
    document.body.appendChild(div);
    const m = div.querySelector('#am');
    div.querySelector('#bl').onclick = async () => {
      const res = await apiRequest('/auth/login', 'POST', {username: div.querySelector('#u').value, password: div.querySelector('#p').value});
      if(res.status === 'success') { currentUser = div.querySelector('#u').value; localStorage.setItem('win11_user', currentUser); div.remove(); await loadCloudFiles(); }
      else m.innerText = res.message || 'Error';
    };
    div.querySelector('#br').onclick = async () => {
      const res = await apiRequest('/auth/register', 'POST', {username: div.querySelector('#u').value, password: div.querySelector('#p').value});
      m.innerText = res.status === 'success' ? 'Created! Please sign in.' : (res.message || 'Error');
    };
  }

  class Win11Extension {
    getInfo() {
      return { id: "win11", name: "Windows 11 Simulator", blocks: [ { opcode: "init", blockType: Scratch.BlockType.COMMAND, text: "Windowsを起動" } ] };
    }
    init() {
      if (!initialized) {
        createDesktop();
        initialized = true;
        if (currentUser) loadCloudFiles(); else showLoginUI();
      }
    }
  }

  Scratch.extensions.register(new Win11Extension());
})(Scratch);
