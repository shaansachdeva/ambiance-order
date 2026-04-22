# Thermal Printer Integration Plan

## Goal
Replace the current browser-based barcode printing (html2canvas → window.print) with direct-to-printer communication for TSC and Zebra thermal label printers. Fixes: printer hangs, inconsistent sizing, browser scaling issues, slow batch prints.

## Current State (as of 2026-04-23)
- File: `src/app/(dashboard)/barcode/page.tsx` (~943 lines)
- Approach: `html2canvas-pro` captures the preview div → opens new window → `window.print()`
- Problems reported: printer hangs, labels come out small, inconsistent sizes, general unreliability
- Label designer supports: custom sizes (mm), freeform positioning, multiple fonts, logos, decorative lines, rotation, barcode formats (CODE128, CODE39, EAN13, EAN8, UPC, ITF14)

## Printers in Use
- **TSC TE244** — 203 DPI, thermal transfer (ribbon), desktop
- **Zebra** — model unknown, needs to be confirmed before work starts
- Printers connected to different computers across the office
- Printing triggered from the web app

## Approach: Bitmap + QZ Tray

### Why bitmap (not pure ZPL/TSPL commands)
The label designer allows arbitrary layouts, fonts, logos, decorative lines. Translating every possible design into native ZPL/TSPL commands would either (a) require restricting what designers can do, or (b) be enormous work (font rasterization, logo conversion, line-by-line translation). Rendering the label as a monochrome bitmap at printer DPI preserves full design freedom and still gets us direct-to-printer speed.

### Pipeline
1. User designs label in existing UI (no change to design tools)
2. On Print: canvas → render at exact mm-to-dots ratio for target DPI (203 for TE244)
3. Convert to 1-bit monochrome bitmap (Floyd-Steinberg dithering for any grayscale/logo content)
4. Wrap bitmap in printer command:
   - Zebra: `^GFA` (Graphic Field, ASCII) inside ZPL
   - TSC: `BITMAP` command in TSPL
5. Send raw bytes via QZ Tray to the configured printer
6. No browser print dialog, no OS involvement beyond the TCP socket QZ Tray opens

### Why QZ Tray
- Free for self-signed use (development/internal); paid signed cert (~$1/printer/month) to avoid browser warnings in production
- Works from browser over secure WebSocket to local daemon
- Standard tool — used by Odoo, ERPNext, Dolibarr, many POS systems
- Handles USB, network, and serial printers uniformly

## Work Breakdown

### Backend/Library
- [ ] `npm install qz-tray` — JS client for QZ Tray WebSocket API
- [ ] `src/lib/printing/zpl.ts` — bitmap → ZPL `^GFA` command
- [ ] `src/lib/printing/tspl.ts` — bitmap → TSPL `BITMAP` command
- [ ] `src/lib/printing/qz.ts` — connection manager, printer list, send raw bytes
- [ ] `src/lib/printing/rasterize.ts` — canvas → monochrome 1-bit bitmap at target DPI

### UI Changes (barcode page)
- [ ] New "Printer Settings" section — pick printer from QZ Tray's list, save per computer (localStorage keyed by user agent or session)
- [ ] Auto-detect printer language (TSC vs Zebra) from model string, allow manual override
- [ ] Keep existing "Browser Print" as fallback option when QZ Tray isn't available
- [ ] Status indicator — connected / not connected / no QZ Tray installed
- [ ] Print button flow: if QZ Tray available → use it; else → existing html2canvas path

### User-side Setup (documented, not code)
- [ ] Install QZ Tray on each computer with a printer (one-time)
- [ ] Windows/Mac installer available from qz.io
- [ ] First time connecting → browser permission prompt (self-signed cert warning for dev)
- [ ] Printer should already be installed in OS; QZ Tray lists it automatically

### Testing Plan
1. Start with TSC TE244 (model confirmed, known DPI)
2. Test with simple label (one text field, one barcode) first — verify pipeline end-to-end
3. Add complexity progressively: logos, decorative lines, rotation, multi-field
4. Once TSC works, find the Zebra model, test ZPL path
5. Test from 2+ different computers to validate per-computer printer config

## Open Questions (confirm before starting)
1. **Zebra model?** — determines DPI (203 vs 300) and ZPL dialect
2. **Production QZ Tray cert?** — free self-signed works but shows browser warnings; recommend $1/printer/month signed cert for production. User to decide.
3. **Network printers in future?** — current printers are USB/local per computer, but QZ Tray supports networked printers if that changes
4. **Fallback behavior** — when QZ Tray not installed, should we hide the print button or fall back to current browser print?

## Estimated Effort
- Core pipeline + single-printer test: 3-4 hours
- Both printer languages + polish: 5-6 hours total
- User installation + training: 15 min per computer

## Not in Scope (for this first version)
- Label preview showing exact dithered output (can add later if users report mismatches)
- Printer queue management / print history
- Error recovery when printer runs out of ribbon/labels mid-batch
- Printer-side error reporting back to the UI (would need polling)

## When Picking This Up
- Read `src/app/(dashboard)/barcode/page.tsx` lines 385-465 for current print logic
- Read `src/components/LabelPreviewRenderer.tsx` for how labels are rendered to HTML/SVG
- Start with `src/lib/printing/rasterize.ts` since that feeds everything downstream
- Don't rip out the existing html2canvas path until the new one is proven working
