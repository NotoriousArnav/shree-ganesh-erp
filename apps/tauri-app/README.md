# Ganesha ERP — Tauri shell

Basic [Tauri v2](https://v2.tauri.app/) wrapper for the ERP suite, used to produce
desktop and Android binaries from this monorepo.

- Frontend: Vite + TypeScript (`src/`, `index.html`)
- Rust shell: `src-tauri/`
- CI: `.github/workflows/tauri.yml`

## Local development

```bash
# from the repository root
npm install
npm run build:packages

cd apps/tauri-app
npm run tauri dev        # desktop dev with hot reload
npm run tauri build      # desktop bundle for the current platform
```

## CI targets

| Platform | Target | Notes |
| --- | --- | --- |
| macOS | `universal-apple-darwin` | Covers x86_64 + arm64 in one bundle. Apple has no 32-bit ARM target. |
| Windows | `x86_64-pc-windows-msvc` | Required. NSIS + MSI. |
| Windows | `i686-pc-windows-msvc` | 32-bit x86, best effort. Windows has no ARM32 desktop target. |
| Linux | `x86_64-unknown-linux-gnu` | Required. AppImage + deb. |
| Linux | `aarch64-unknown-linux-gnu` | Required. Native `ubuntu-24.04-arm` runner. |
| Linux | `armv7-unknown-linux-gnueabihf` | Required. Built natively in a 32-bit Raspberry Pi OS VM (`pguyot/arm-runner-action`). |
| Android | universal APK | Required ABIs: `arm64-v8a` + `armeabi-v7a` (plus x86 ABIs for emulators). |

The Android APK/aab is unsigned in CI (falls back to a debug-signed APK when no
keystore is configured). Add keystore secrets later if store-ready signing is
needed.
