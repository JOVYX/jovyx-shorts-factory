# ⚡ Jovyx Shorts Factory

**Local-first video automation and YouTube Shorts creator for eFootball Mobile gameplay recordings captured on an iPhone.**

Built for **Arch Linux** on the **ASUS TUF A16** equipped with an **NVIDIA GeForce RTX 4050 Laptop GPU (6 GB VRAM)**.

---

## 🎯 Purpose & Features

- **Mobile Gameplay Layouts (No Unnatural Stretching):**
  - **Blurred Backdrop (Recommended):** Centers 16:9 mobile gameplay in a vertical 9:16 frame, filled with dynamic Gaussian-blurred gameplay in the background. Scoreboards, radar, and buttons stay crisp.
  - **Center Crop:** 9:16 cropped slice focused on central pitch action.
  - **Dual Stacked:** Wide view on top, zoomed accent view on bottom.
- **Hardware Acceleration:**
  - Automatically utilizes NVIDIA NVENC (`h264_nvenc`) on the RTX 4050 for blazing fast 1080x1920 @ 60 FPS rendering.
  - Safe fallback to `libx264` software encoding.
  - Ultra-lightweight footprint: samples at low resolution to keep the 6GB VRAM completely free.
- **Source Video Preservation:**
  - Original iPhone `.mov` and `.mp4` recordings are **never deleted or overwritten**.
  - All renders and candidate clips live in isolated managed storage directories.
- **Modular Highlight Detection:**
  - Fast visual scene change and motion-energy clustering using OpenCV.
  - Candidate clip extraction with configurable clip durations (15s–60s).
  - Representative frame thumbnail extraction for each candidate.
  - Scorer ranking algorithm factoring visual energy, cut pacing, and duration penalties.
  - User feedback loop: Mark clips as **Good** (👍) or **Bad** (👎) to refine candidate ranking.
  - Extensible `BaseHighlightClassifier` interface ready for vision models (e.g. goal detection).
- **Style Presets:**
  - **Player Card:** Focused 9:16 framing, title hook banner, and subtle vignette.
  - **Gameplay Highlights:** Crisp 60 FPS presentation, blurred background, vibrant color enhancement, and Jovyx branding bar.
  - **Cinematic Football:** Letterbox accent, half-speed slow motion (`0.5x`), warm cinematic grade, and outro subscription CTA.
- **Review Queue & Export:**
  - Interactive 9:16 phone mockup preview player with real-time scrubbing.
  - Rename, edit title & descriptions, and regenerate clips.
  - Approve or reject workflow.
  - One-click **Export MP4** (downloads directly and copies to `storage/exports/`).
- **YouTube OAuth Publishing:**
  - Official YouTube Data API v3 integration with OAuth 2.0 flow.
  - Never requests or stores Google passwords. Tokens stored locally in SQLite.
  - **Uploads start strictly as private** drafts by default.
  - Resumable chunked uploads with exponential backoff on transient errors.
  - If credentials are not configured, the rest of the application runs seamlessly.

---

## 💻 System Requirements & Target Environment

- **OS:** Arch Linux (Kernel 6.x+)
- **Hardware:** ASUS TUF A16 (or any modern Linux machine)
- **RAM:** 16 GB RAM
- **GPU:** NVIDIA GeForce RTX 4050 Laptop GPU (6 GB VRAM) with proprietary NVIDIA drivers (`nvidia`, `nvidia-utils`)
- **Software Dependencies:**
  - Python 3.12+ (tested with Python 3.14)
  - Node.js LTS (tested with Node v26 / npm v12)
  - FFmpeg with NVENC support (`pacman -S ffmpeg`)
  - TTF Fonts (`pacman -S ttf-dejavu noto-fonts`)

---

## 🚀 Quick Start (Arch Linux)

### 1. Clone & Enter Project Directory
```bash
cd /home/jovyxmc/Projects/jovyx-shorts-factory
```

### 2. Install System Dependencies (if not already installed)
```bash
sudo pacman -S --needed ffmpeg nvidia-utils ttf-dejavu python nodejs npm
```

### 3. Verify NVIDIA GPU & FFmpeg NVENC
```bash
nvidia-smi
ffmpeg -encoders | grep nvenc
```

### 4. Configure Environment
```bash
cp .env.example .env
```
*(Optional)* Add your `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET` in `.env` or in the in-app **Settings** page.

### 5. Launch the Application
Run the all-in-one launcher script:
```bash
./run.sh
```
Open **[http://localhost:8000](http://localhost:8000)** in your browser!

### 6. Development Mode (Frontend Hot-Reloading)
To run Vite with hot-module replacement and FastAPI with auto-reload:
```bash
./run.sh --dev
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`

---

## 🧪 Running Unit Tests

Run the backend test suite verifying metadata extraction, filtergraph rendering, candidate ranking, and API routes:

```bash
backend/.venv/bin/pytest -v tests/
```

Test coverage includes:
- `test_probe.py`: FFprobe inspection, resolution, fps fraction calculation, audio detection.
- `test_processor.py`: Filtergraph construction for blurred backgrounds, crop modes, captions, and actual 1080x1920 MP4 rendering.
- `test_highlights.py`: Highlight scoring, motion calculation, and OpenCV visual change candidate extraction.
- `test_api.py`: FastAPI endpoints for health, presets, dashboard statistics, video imports, and Shorts creation.

---

## 📁 Project Architecture

```
jovyx-shorts-factory/
├── run.sh                  # One-click startup script (production / dev mode)
├── .env.example            # Environment template
├── README.md               # Documentation & Arch Linux setup guide
├── tests/                  # Pytest test suite & video fixtures
│   ├── fixtures/           # Sample test videos
│   ├── test_probe.py       # Metadata probe tests
│   ├── test_processor.py   # Vertical rendering tests
│   ├── test_highlights.py  # Highlight detector tests
│   └── test_api.py         # End-to-end API tests
├── backend/
│   ├── requirements.txt    # Python dependencies
│   ├── storage/            # Managed storage
│   │   ├── originals/      # Protected original recording storage
│   │   ├── thumbnails/     # Video & clip JPEG thumbnails
│   │   ├── renders/        # Rendered vertical Shorts (9:16)
│   │   └── exports/        # Final approved export MP4s
│   └── app/
│       ├── main.py         # FastAPI application entrypoint & static mounting
│       ├── config.py       # Pydantic Settings configuration
│       ├── database/       # SQLite + Async SQLAlchemy ORM models
│       ├── models/         # Pydantic request/response schemas
│       ├── video/          # FFprobe metadata, NVENC detection, rendering engine
│       ├── highlights/     # OpenCV scene detection, scoring, candidate clustering
│       ├── publishing/     # YouTube OAuth 2.0 & resumable upload service
│       ├── services/       # Library management, background jobs, presets, AI metadata
│       └── api/            # REST API route controllers
└── frontend/
    ├── src/
    │   ├── api/            # Typed API client
    │   ├── types/          # TypeScript interfaces
    │   ├── components/     # Navbar, Phone Mockup, Modals, File Picker
    │   ├── pages/          # Dashboard, Library, Highlights, Shorts Editor, Review Queue, Presets, Publishing, Settings
    │   ├── index.css       # Obsidian & Neon dark mode design system
    │   └── App.tsx         # Root component & navigation state
    ├── package.json
    └── vite.config.ts
```

---

## 🔒 Reliability & Safety Guarantees

1. **Subprocess Argument Lists:** All FFmpeg and FFprobe calls execute using explicit argument lists `[...args]` without `shell=True`, preventing shell injection vulnerabilities.
2. **File Path Validation:** User-supplied paths are validated, checking existence, regular file status, and extension whitelisting (`.mov`, `.mp4`, `.m4v`, `.mkv`, `.webm`).
3. **Source Video Immutability:** Source recordings are never deleted or modified. Copy or safe in-place reference preserves gameplay captures intact.
4. **VRAM Safety:** Highlight sampling processes lightweight grayscale downscaled frames (160x90) keeping the RTX 4050 6GB VRAM unburdened.
5. **Private YouTube Uploads:** Uploads default to `private` privacy status and require explicit user review and approval before publishing.

---

## 👤 Author
Developed for **Jovyx** — eFootball Mobile Creator Automation.
