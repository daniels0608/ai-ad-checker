# Ad-Pretest – Vercel (Client-only)

**Zweck:** Vercel-fertiges Projekt (Next.js 14), das Bild-Ads **komplett im Browser** analysiert: Heatmap (Laplacian-Proxy), OCR (tesseract.js), einfache Scores. **Kein Server nötig** ⇒ sofort auf Vercel deploybar.

## Lokaler Start
```bash
npm i # oder pnpm i / yarn
npm run dev
```
Öffne http://localhost:3000

## Deploy auf Vercel
1) Repository auf GitHub hochladen (Ordnerinhalt).
2) In Vercel: **New Project → Import Git Repository**.
3) Framework: **Next.js** (Autodetect), Build-Command: `next build`, Output: `.next` (default).
4) Deploy. Fertig.

> Hinweis: Diese Client-Version nutzt heuristische Saliency (Laplacian) und liefert solide, aber einfache Scores. Für präzisere Ergebnisse (Saliency-Modelle, CTA/Logo-Detection) nutze die **FastAPI-Variante** als API.
