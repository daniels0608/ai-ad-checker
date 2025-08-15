# Ad-Pretest – Vercel (Client + Mini-API)

**Features**
- PNG/JPG Upload
- OCR (tesseract.js), heuristische Saliency (Laplacian)
- Optional: externe Heatmap per URL **über die eigene Proxy-API** einmischen
- Vercel-fertig (Next.js 14 App Router, Edge Runtime für API)

## Start lokal
```bash
npm i
npm run dev
# http://localhost:3000
```

## Deploy (Vercel)
1) Repo nach GitHub hochladen.
2) Vercel → New Project → Import.
3) Optional Secret setzen: `HEATMAP_API_KEY` (falls externe API einen Bearer-Key braucht).

## API
- `GET /api/proxy-heatmap?url=<ENCODED_URL>` → Lädt ein Bild (PNG/JPG) und streamt es zurück.
  - Wenn `HEATMAP_API_KEY` gesetzt ist, sendet die Route `Authorization: Bearer <KEY>` an die Upstream-API.

## Fusion
Der Client lädt optional eine externe Heatmap (via Proxy), normalisiert sie auf [0..1] und mischt sie mit der internen Saliency (`w=0.7` → kalibrierbar).
