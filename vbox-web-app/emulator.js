/**
 * VirtualBox Web Edition - Standalone Controller
 * Version 4.0.0 - No Backend Required
 */

let emulator = null;
let currentVM = {
    id: 'standalone-win11',
    name: 'Windows 11 (Local)',
};

// --- Storage Logic (IndexedDB for Large Files) ---
const DB_NAME = 'VirtualBoxWebDB';
const STORE_NAME = 'vm_states';

function openDB() {
    return new Promise((resolve, reject) => {
        try {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(new Error("IndexedDB Access Denied (Use launcher.bat)"));
        } catch (e) {
            reject(new Error("Storage API not available in this context."));
        }
    });
}

async function saveStateToDB(id, state) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.put(state, id);
        transaction.oncomplete = () => resolve();
        transaction.onerror = (e) => reject(e.target.error);
    });
}

async function loadStateFromDB(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

// --- VM Actions ---
async function startVM() {
    const displayContainer = document.getElementById('vm-display-container');
    const detailsView = document.getElementById('vm-details');
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const saveBtn = document.getElementById('save-btn');
    const bootLoader = document.getElementById('boot-loader');
    const statusText = document.getElementById('stat-text');

    detailsView.style.display = 'none';
    displayContainer.style.display = 'block';
    bootLoader.style.display = 'flex';
    
    startBtn.disabled = true;
    stopBtn.disabled = false;
    saveBtn.disabled = false;
    
    statusText.innerText = "Initializing local environment...";

    try {
        await initEmulator();
        bootLoader.style.display = 'none';
        statusText.innerText = "Running Standalone";
        document.getElementById('cloud-sync-indicator').style.display = 'block';
    } catch (err) {
        console.error(err);
        alert("Failed to start emulator: " + err.message);
        stopVM();
    }
}

function stopVM() {
    if (emulator) {
        emulator.stop();
        emulator = null;
    }
    const displayContainer = document.getElementById('vm-display-container');
    const detailsView = document.getElementById('vm-details');
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const saveBtn = document.getElementById('save-btn');
    const statusText = document.getElementById('stat-text');

    displayContainer.style.display = 'none';
    detailsView.style.display = 'block';
    
    startBtn.disabled = false;
    stopBtn.disabled = true;
    saveBtn.disabled = true;
    
    statusText.innerText = "Virtual Machine Powered Off";
    document.getElementById('cloud-sync-indicator').style.display = 'none';
}

async function saveVMState() {
    if (!emulator) return;
    
    const statusText = document.getElementById('stat-text');
    statusText.innerText = "Saving to browser storage...";
    
    try {
        const state = await emulator.save_state();
        await saveStateToDB(currentVM.id, state);
        
        const now = new Date().toLocaleString();
        document.getElementById('last-save').innerText = now;
        statusText.innerText = "Saved to IndexedDB: " + now;
    } catch (err) {
        console.error("Save failed:", err);
        statusText.innerText = "Save failed (Quota exceeded?)";
    }
}

// --- v86 Engine Integration ---
let isoObjectURL = null;

async function initEmulator() {
    const settings = {
        canvas: document.getElementById("screen"),
        wasm_path: "v86/v86.wasm",
        bios: { url: "v86/seabios.bin" },
        vga_bios: { url: "v86/vgabios.bin" },
        memory_size: 512 * 1024 * 1024,
        vga_memory_size: 32 * 1024 * 1024,
        autostart: true,
    };

    // Load ISO if selected
    if (isoObjectURL) {
        settings.cdrom = { url: isoObjectURL };
    } else {
        // Default to a small Linux image if no ISO is chosen
        settings.cdrom = { url: "https://copy.sh/v86/images/linux.iso" };
    }

    // Try to load previous state
    const savedState = await loadStateFromDB(currentVM.id);
    if (savedState) {
        if (confirm("以前の保存データが見つかりました。再開しますか？")) {
            settings.initial_state = savedState;
        }
    }

    emulator = new V86(settings);
}

// --- ISO Management ---
function uploadISO() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.iso';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Clean up old URL if exists
        if (isoObjectURL) URL.revokeObjectURL(isoObjectURL);
        
        isoObjectURL = URL.createObjectURL(file);
        document.getElementById('current-iso-name').innerText = file.name;
        alert(`ISO「${file.name}」をマウントしました。「起動」ボタンを押してください。`);
    };
    input.click();
}

// --- WebUSB Integration ---
async function requestUSB() {
    try {
        const device = await navigator.usb.requestDevice({ filters: [] });
        alert(`USB connected: ${device.productName}`);
    } catch (err) {
        console.error("USB Access Denied:", err);
    }
}

function createVM() {
    const name = document.getElementById('new-vm-name').value || "Standalone VM";
    alert(`VM "${name}" initialized.`);
    hideModal('new-vm-modal');
}

// Initial UI setup
document.addEventListener('DOMContentLoaded', async () => {
    console.log("VirtualBox Standalone Mode Active.");
    
    // Check if running on file:// protocol
    if (window.location.protocol === 'file:') {
        alert("【重要】ブラウザのセキュリティ制限により、file:// プロトコルでは正常に動作しない可能性があります。\n同梱の「launcher.bat」をダブルクリックして起動してください。");
        document.getElementById('cloud-storage-status').innerText = "ERROR: USE LAUNCHER.BAT";
        document.getElementById('cloud-storage-status').style.color = "#ff4444";
    } else {
        document.getElementById('cloud-storage-status').innerText = "BROWSER (IndexedDB)";
        document.getElementById('cloud-storage-status').style.color = "#00ff00";
    }
});
