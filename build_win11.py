#!/usr/bin/env python3
"""
Windows 11 Simulator - TurboWarp .sb3 Builder
Generates a complete Scratch 3.0 project file with Windows 11 wallpapers
and initialization blocks for the custom extension.

Usage: python build_win11.py [extension_url]
Args:  extension_url - URL to win11_extension.js (default: http://localhost:8888/win11_extension.js)
Output: windows11_sim.sb3
"""

import json
import zipfile
import hashlib
import os
import sys
import struct
import zlib
import io

# ============================================================
# PNG Generator (no external dependencies)
# ============================================================

def create_png(width, height, pixels):
    """Create a minimal PNG file from raw pixel data (list of (r,g,b) tuples)."""
    def chunk(ctype, data):
        c = ctype + data
        crc = struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
        return struct.pack(">I", len(data)) + c + crc

    # IHDR
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)  # 8-bit RGB
    
    # IDAT - raw pixel data
    raw = b""
    for y in range(height):
        raw += b"\x00"  # filter: none
        for x in range(width):
            idx = y * width + x
            r, g, b = pixels[idx]
            raw += struct.pack("BBB", r, g, b)
    
    compressed = zlib.compress(raw, 9)
    
    # Assemble PNG
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", ihdr)
    png += chunk(b"IDAT", compressed)
    png += chunk(b"IEND", b"")
    return png


def lerp_color(c1, c2, t):
    """Linear interpolation between two colors."""
    return (
        int(c1[0] + (c2[0] - c1[0]) * t),
        int(c1[1] + (c2[1] - c1[1]) * t),
        int(c1[2] + (c2[2] - c1[2]) * t),
    )


def blend_colors(base, overlay_c, alpha):
    """Alpha blend two colors."""
    return (
        int(base[0] * (1 - alpha) + overlay_c[0] * alpha),
        int(base[1] * (1 - alpha) + overlay_c[1] * alpha),
        int(base[2] * (1 - alpha) + overlay_c[2] * alpha),
    )


def clamp(v, lo=0, hi=255):
    return max(lo, min(hi, int(v)))


import math

def create_wallpaper_dark_abstract(w, h):
    """Dark wallpaper with colorful abstract gradient blobs (approximation of user's image 1)."""
    pixels = []
    for y in range(h):
        for x in range(w):
            ny = y / h
            nx = x / w
            
            # Dark base
            base = (8, 6, 16)
            
            # Pink/magenta blob (left-center)
            dx = nx - 0.4
            dy = ny - 0.5
            d1 = math.sqrt(dx*dx + dy*dy)
            if d1 < 0.4:
                t = max(0, 1 - d1 / 0.4)
                t = t * t
                blob1 = (220, 40, 100)
                base = blend_colors(base, blob1, t * 0.8)
            
            # Gold/orange blob (center)
            dx = nx - 0.5
            dy = ny - 0.4
            d2 = math.sqrt(dx*dx + dy*dy)
            if d2 < 0.3:
                t = max(0, 1 - d2 / 0.3)
                t = t * t
                blob2 = (255, 170, 40)
                base = blend_colors(base, blob2, t * 0.7)
            
            # Blue/purple blob (right)
            dx = nx - 0.65
            dy = ny - 0.45
            d3 = math.sqrt(dx*dx + dy*dy)
            if d3 < 0.35:
                t = max(0, 1 - d3 / 0.35)
                t = t * t
                blob3 = (80, 50, 200)
                base = blend_colors(base, blob3, t * 0.5)
            
            # Cyan/teal accent (right edge)
            dx = nx - 0.75
            dy = ny - 0.55
            d4 = math.sqrt(dx*dx + dy*dy)
            if d4 < 0.25:
                t = max(0, 1 - d4 / 0.25)
                t = t * t
                blob4 = (100, 200, 240)
                base = blend_colors(base, blob4, t * 0.3)
            
            pixels.append((clamp(base[0]), clamp(base[1]), clamp(base[2])))
    return pixels


def create_wallpaper_light_bloom(w, h):
    """Light blue bloom wallpaper (approximation of user's image 2)."""
    pixels = []
    for y in range(h):
        for x in range(w):
            ny = y / h
            nx = x / w
            
            # Light gradient background
            bg_top = (186, 214, 240)
            bg_bottom = (220, 235, 248)
            base = lerp_color(bg_top, bg_bottom, ny)
            
            # Blue bloom center
            dx = nx - 0.5
            dy = ny - 0.5
            d = math.sqrt(dx*dx + dy*dy)
            
            if d < 0.45:
                t = max(0, 1 - d / 0.45)
                # Multi-layered bloom
                bloom_outer = (60, 130, 200)
                bloom_inner = (26, 95, 180)
                bloom_core = (20, 80, 160)
                
                if t > 0.7:
                    color = lerp_color(bloom_inner, bloom_core, (t - 0.7) / 0.3)
                elif t > 0.3:
                    color = lerp_color(bloom_outer, bloom_inner, (t - 0.3) / 0.4)
                else:
                    color = bloom_outer
                
                # Swirl effect
                angle = math.atan2(dy, dx)
                swirl = math.sin(angle * 5 + d * 10) * 0.15
                intensity = t * t * (0.8 + swirl)
                base = blend_colors(base, color, min(1, intensity))
            
            pixels.append((clamp(base[0]), clamp(base[1]), clamp(base[2])))
    return pixels


def create_wallpaper_dark_bloom(w, h):
    """Dark blue bloom wallpaper (approximation of user's image 3)."""
    pixels = []
    for y in range(h):
        for x in range(w):
            ny = y / h
            nx = x / w
            
            # Dark background gradient
            bg_top = (8, 16, 32)
            bg_bottom = (12, 24, 48)
            base = lerp_color(bg_top, bg_bottom, ny)
            
            # Blue bloom center (slightly offset)
            dx = nx - 0.52
            dy = ny - 0.48
            d = math.sqrt(dx*dx + dy*dy)
            
            if d < 0.42:
                t = max(0, 1 - d / 0.42)
                bloom_outer = (30, 80, 180)
                bloom_inner = (20, 60, 160)
                bloom_core = (40, 100, 220)
                
                if t > 0.6:
                    color = lerp_color(bloom_inner, bloom_core, (t - 0.6) / 0.4)
                elif t > 0.2:
                    color = lerp_color(bloom_outer, bloom_inner, (t - 0.2) / 0.4)
                else:
                    color = bloom_outer
                
                # Organic swirl pattern
                angle = math.atan2(dy, dx)
                ripple = math.sin(angle * 6 + d * 12) * 0.2
                fold = math.sin(angle * 3 - d * 8) * 0.1
                intensity = t * t * (0.85 + ripple + fold)
                base = blend_colors(base, color, min(1, max(0, intensity)))
            
            # Subtle ambient glow
            glow = max(0, 0.1 - d * 0.15)
            base = blend_colors(base, (30, 60, 140), glow)
            
            pixels.append((clamp(base[0]), clamp(base[1]), clamp(base[2])))
    return pixels


# ============================================================
# Asset Helpers
# ============================================================

def md5_bytes(data):
    return hashlib.md5(data).hexdigest()


def md5_file(filepath):
    with open(filepath, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()


# ============================================================
# Block Builder (reused from scratch-gemini)
# ============================================================

def iN(num): return [1, [4, str(num)]]
def iS(txt): return [1, [10, str(txt)]]
def iB(blk_id): return [2, blk_id]
def iR(blk_id): return [3, blk_id, [10, ""]]


class B:
    def __init__(self):
        self.blocks = {}
        self.next_id = 1

    def gen_id(self):
        res = f"B_{self.next_id:04d}"
        self.next_id += 1
        return res

    def _blk(self, op, inputs, fields, parent=None, next_b=None, top=False, shadow=False):
        uid = self.gen_id()
        self.blocks[uid] = {
            "opcode": op,
            "next": next_b,
            "parent": parent,
            "inputs": inputs,
            "fields": fields,
            "shadow": shadow,
            "topLevel": top,
        }
        return uid

    def _chain(self, blks, parent=None, top=False):
        if not blks:
            return None
        for i in range(len(blks) - 1):
            self.blocks[blks[i]]["next"] = blks[i + 1]
        self.blocks[blks[0]]["topLevel"] = top
        if top:
            self.blocks[blks[0]]["x"] = 50
            self.blocks[blks[0]]["y"] = 50
        return blks[0]

    # Events
    def flag(self):
        return self._blk("event_whenflagclicked", {}, {}, top=True)

    # Control
    def forever(self, sub):
        return self._blk("control_forever", {"SUBSTACK": iB(sub)}, {})

    def wait(self, sec):
        return self._blk("control_wait", {"DURATION": [1, [5, str(sec)]]}, {})

    # Custom Extension blocks
    def win11_init(self):
        return self._blk("win11_initDesktop", {}, {})

    def resolve_parents(self):
        for uid, blk in self.blocks.items():
            if blk.get("next"):
                self.blocks[blk["next"]]["parent"] = uid
            for iname, ival in blk.get("inputs", {}).items():
                if isinstance(ival, list) and len(ival) >= 2 and ival[0] in [2, 3]:
                    target = ival[1]
                    if isinstance(target, str) and target in self.blocks:
                        self.blocks[target]["parent"] = uid


# ============================================================
# Build Function
# ============================================================

def build():
    W, H = 480, 360
    
    # Extension URL (can be overridden via command line)
    ext_url = "https://web-production-18337.up.railway.app/win11_extension.js"
    if len(sys.argv) > 1:
        ext_url = sys.argv[1]
    
    print("=" * 50)
    print("  Windows 11 Simulator - .sb3 Builder")
    print("=" * 50)
    
    # ---- Check for existing PNG wallpapers ----
    wallpaper_files = []
    png_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Look for user-provided wallpaper files
    for f in sorted(os.listdir(png_dir)):
        if f.lower().startswith("wallpaper") and f.lower().endswith((".png", ".jpg", ".jpeg")):
            wallpaper_files.append(os.path.join(png_dir, f))
    
    # ---- Load Wallpaper Assets ----
    wallpaper_assets = []
    wp_names = ["Fluid Abstract", "Blue Bloom Light", "Blue Bloom Dark", "Organic Abstract"]
    
    for i in range(1, 5):
        fname = f"wallpaper_{i}.jpg"
        if os.path.exists(fname):
            with open(fname, "rb") as f:
                wallpaper_assets.append(f.read())
            print(f"  [OK] Loaded {fname}")
        else:
            # Fallback to procedural if missing (should not happen if copy succeeded)
            print(f"  [WARN] {fname} not found, generating sample...")
            wallpaper_assets.append(create_png(W, H, create_wallpaper_light_bloom(W, H)))

    # ---- Build costumes for wallpapers ----
    backdrop_costumes = []
    backdrop_asset_map = {}
    
    for i, wp_data in enumerate(wallpaper_assets):
        md5 = md5_bytes(wp_data)
        ext = "jpg"
        md5ext = f"{md5}.{ext}"
        backdrop_costumes.append({
            "assetId": md5,
            "name": wp_names[i],
            "md5ext": md5ext,
            "dataFormat": ext,
            "rotationCenterX": W // 2,
            "rotationCenterY": H // 2,
        })
        backdrop_asset_map[md5ext] = wp_data    
    # ---- Build Scratch blocks ----
    print("[INFO] Building Scratch blocks...")
    b = B()
    
    # Sequence: When Flag Clicked -> Windows Init
    f = b.flag()
    i = b.win11_init()
    b._chain([f, i], top=True)
    b.resolve_parents()
    
    # ---- Create empty costume for controller sprite ----
    empty_svg = '<svg version="1.1" width="2" height="2" viewBox="-1 -1 2 2" xmlns="http://www.w3.org/2000/svg"></svg>'
    empty_svg_bytes = empty_svg.encode("utf-8")
    empty_md5 = md5_bytes(empty_svg_bytes)
    
    wait1 = b.wait(0.5)
    
    # Forever loop (keeps the project running)
    wait_loop = b.wait(1)
    forever = b.forever(wait_loop)
    
    b._chain([start, init, wait1, forever], top=True)
    b.resolve_parents()
    
    # ---- Build costumes for wallpapers ----
    backdrop_costumes = []
    backdrop_asset_map = {}  # md5ext -> bytes
    
    wp_names = ["Dark Abstract", "Light Bloom", "Dark Bloom"]
    for i, wp_data in enumerate(wallpaper_assets):
        md5 = md5_bytes(wp_data)
        ext = "png"
        md5ext = f"{md5}.{ext}"
        backdrop_costumes.append({
            "assetId": md5,
            "name": wp_names[i] if i < len(wp_names) else f"wallpaper_{i+1}",
            "md5ext": md5ext,
            "dataFormat": ext,
            "rotationCenterX": W // 2,
            "rotationCenterY": H // 2,
        })
        backdrop_asset_map[md5ext] = wp_data
    
    # ---- Build project JSON ----
    print("[INFO] Building project.json...")
    
    project = {
        "targets": [
            {
                "isStage": True,
                "name": "Stage",
                "variables": {},
                "lists": {},
                "broadcasts": {},
                "blocks": {},
                "comments": {},
                "currentCostume": 0,
                "costumes": backdrop_costumes,
                "sounds": [],
                "volume": 100,
                "layerOrder": 0,
                "tempo": 60,
                "videoTransparency": 50,
                "videoState": "on",
                "textToSpeechLanguage": None,
            },
            {
                "isStage": False,
                "name": "Win11Controller",
                "variables": {},
                "lists": {},
                "broadcasts": {},
                "blocks": b.blocks,
                "comments": {},
                "currentCostume": 0,
                "costumes": [
                    {
                        "assetId": empty_md5,
                        "name": "empty",
                        "md5ext": f"{empty_md5}.svg",
                        "dataFormat": "svg",
                        "rotationCenterX": 1,
                        "rotationCenterY": 1,
                    }
                ],
                "sounds": [],
                "volume": 100,
                "layerOrder": 1,
                "visible": False,
                "x": 0,
                "y": 0,
                "size": 100,
                "direction": 90,
                "draggable": False,
                "rotationStyle": "all around",
            },
        ],
        "monitors": [],
        "extensions": ["win11"],
        "extensionURLs": {
            "win11": ext_url,
        },
        "meta": {
            "semver": "3.0.0",
            "vm": "2.2.0-tw",
            "agent": "win11-builder",
        },
    }
    
    # ---- Package .sb3 ----
    out_file = os.path.join(png_dir, "windows11_sim.sb3")
    print(f"\n[INFO] Packaging {out_file}...")
    
    with zipfile.ZipFile(out_file, "w", zipfile.ZIP_DEFLATED) as zf:
        # project.json
        zf.writestr("project.json", json.dumps(project, ensure_ascii=False))
        
        # Wallpaper assets
        for md5ext, data in backdrop_asset_map.items():
            zf.writestr(md5ext, data)
        
        # Empty SVG for controller sprite
        zf.writestr(f"{empty_md5}.svg", empty_svg_bytes)
    
    file_size = os.path.getsize(out_file)
    print(f"\n{'=' * 50}")
    print(f"  [OK] Generated: windows11_sim.sb3")
    print(f"  File size: {file_size:,} bytes ({file_size/1024:.1f} KB)")
    print(f"{'=' * 50}")
    print(f"\n使い方:")
    print(f"  1. TurboWarp (https://turbowarp.org/editor) を開く")
    print(f"  2. windows11_sim.sb3 を読み込む")
    print(f"  3. 拡張機能 > カスタム拡張機能を読み込む > win11_extension.js を選択")
    print(f"  4. グリーンフラッグをクリック")
    print(f"  5. Windows 11 デスクトップをお楽しみください！")


if __name__ == "__main__":
    build()
