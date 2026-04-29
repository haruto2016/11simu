# VirtualBox Web Standalone Bundler
# This script creates a single HTML file that works offline and without a server.

$sourceHtml = "$PSScriptRoot\portable_vbox.html"
$libv86 = "$PSScriptRoot\v86\libv86.js"
$wasmB64 = "$PSScriptRoot\v86_wasm_b64.txt"
$biosB64 = "$PSScriptRoot\seabios_b64.txt"
$vgaB64 = "$PSScriptRoot\vgabios_b64.txt"
$targetFile = "$PSScriptRoot\..\standalone_win11.html"

echo "Reading source files from $PSScriptRoot..."
$html = (Get-Content $sourceHtml -Raw -Encoding UTF8).Trim()
$js = (Get-Content $libv86 -Raw -Encoding UTF8).Trim()
$wasm = (Get-Content $wasmB64 -Raw -Encoding Unicode).Trim()
$bios = (Get-Content $biosB64 -Raw -Encoding Unicode).Trim()
$vga = (Get-Content $vgaB64 -Raw -Encoding Unicode).Trim()

echo "Injecting assets..."

# 1. Inject libv86.js
$html = $html -replace '<script src="v86/libv86.js"></script>', "<script>`n$js`n</script>"

# 2. Add Base64 data and conversion logic
$bundleScript = @"
    // Asset Bundler Logic
    const ASSETS = {
        wasm: ``$wasm``,
        bios: ``$bios``,
        vga: ``$vga``
    };

    function b64ToArrayBuffer(b64) {
        const bin = atob(b64.replace(/\s/g, ''));
        const len = bin.length;
        const arr = new Uint8Array(len);
        for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
        return arr.buffer;
    }

    console.log("Decoding assets to memory...");
    const WASM_BUFFER = b64ToArrayBuffer(ASSETS.wasm);
    const BIOS_BUFFER = b64ToArrayBuffer(ASSETS.bios);
    const VGA_BUFFER = b64ToArrayBuffer(ASSETS.vga);
    console.log("Assets loaded into memory successfully.");
"@

$html = $html -replace '/\* Inlined libv86.js logic or reference \*/', $bundleScript

# 3. Update startVM to use memory buffers and enable network
$html = $html -replace 'wasm_path: "v86/v86.wasm"', "wasm_fn: (imports) => WebAssembly.instantiate(WASM_BUFFER, imports).then(res => res.instance.exports)"
$html = $html -replace 'url: "v86/seabios.bin"', "buffer: BIOS_BUFFER"
$html = $html -replace 'url: "v86/vgabios.bin"', "buffer: VGA_BUFFER"

# Enable Network Relay and Disable Speaker (to fix AudioWorklet crash on file://)
$extraSettings = "`n                network_relay_url: 'wss://relay.widgetry.org/',`n                disable_speaker: true,"
$html = $html -replace 'vga_bios:', "$extraSettings`n                vga_bios:"

echo "Writing final file: $targetFile"
[System.IO.File]::WriteAllText($targetFile, $html, [System.Text.Encoding]::UTF8)
echo "Done! You can now open $targetFile directly in any browser."
