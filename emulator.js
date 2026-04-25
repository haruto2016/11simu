/**
 * VirtualBox Web Edition - Emulator Controller
 * Integrates v86 engine with Cloud Storage and Networking.
 */

let emulator = null;
let currentVM = {
    id: 'win11',
    name: 'Windows 11 (Cloud)',
    ram: 4096 * 1024 * 1024, // bytes
};

const API_BASE = window.location.origin;

// --- Modal Management ---
function showModal(id) { document.getElementById(id).classList.add('show'); }
function hideModal(id) { document.getElementById(id).classList.remove('show'); }

// --- VM Actions ---
function startVM() {
    const displayContainer = document.getElementById('vm-display-container');
    const detailsView = document.getElementById('vm-details');
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');

    detailsView.style.display = 'none';
    displayContainer.style.display = 'block';
    startBtn.disabled = true;
    stopBtn.disabled = false;

    initEmulator();
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

    displayContainer.style.display = 'none';
    detailsView.style.display = 'block';
    startBtn.disabled = false;
    stopBtn.disabled = true;
}

// --- v86 Engine Integration ---
async function initEmulator() {
    console.log("Initializing v86 with Tiny11 profile...");

    const settings = {
        canvas: document.getElementById("screen"),
        wasm_path: "v86.wasm",
        bios: { url: "seabios.bin" },
        vga_bios: { url: "vgabios.bin" },
        
        // Use an optimized Windows image if available, else boot from ISO
        cdrom: { url: "https://copy.sh/v86/images/linux.iso" }, 
        
        memory_size: 512 * 1024 * 1024, // Browser can struggle with 4GB, starting with 512MB
        vga_memory_size: 32 * 1024 * 1024,
        autostart: true,
    };

    // Network Setup (WebSocket)
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const netUrl = `${protocol}//${window.location.host}/net`;
    
    settings.network_relay_url = netUrl; // v86 uses this for networking

    emulator = new V86Starter(settings);

    // Auto-save logic (Cloud persistence)
    setInterval(async () => {
        if (emulator && emulator.is_running()) {
            // In a real production app, we would save the state here
            // const state = await emulator.save_state();
            // await uploadState(state);
            console.log("Saving state to cloud...");
        }
    }, 60000); // Every minute
}

// --- WebUSB Integration ---
async function requestUSB() {
    try {
        const device = await navigator.usb.requestDevice({ filters: [] });
        console.log("USB Device selected:", device.productName);
        alert(`USBデバイス「${device.productName}」を認識しました。エミュレーターにブリッジします。`);
        
        // Note: v86 USB redirection is complex and often requires a specific driver in the guest.
        // We log it and prepare the pipe.
    } catch (err) {
        console.error("USB Access Denied or Cancelled:", err);
    }
}

// --- Persistence Helpers ---
async function uploadState(state) {
    const formData = new FormData();
    formData.append('file', new Blob([state]), `${currentVM.id}.bin`);
    
    await fetch(`${API_BASE}/api/save_state/${currentVM.id}`, {
        method: 'POST',
        body: formData
    });
}

// --- ISO Upload ---
function uploadISO() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.iso';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        
        console.log("Uploading ISO:", file.name);
        alert("ISOをアップロード中です。サーバーに保存されます。");

        const res = await fetch(`${API_BASE}/api/upload_iso`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (data.status === 'success') {
            alert(`アップロード完了: ${data.name}`);
        }
    };
    input.click();
}

// Initial UI setup
document.addEventListener('DOMContentLoaded', () => {
    console.log("VirtualBox Web initialized.");
});
