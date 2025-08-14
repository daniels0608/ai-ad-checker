# Ad-Pretest MVP

Ein MVP zur Vorab-Bewertung von Social-Ad-Creatives (Bilder). Liefert Heatmap und Scores (Attention, Clarity, CTA, Branding-Heuristik, Readability, Visual Noise) als JSON.

## 1) Lokales Setup

### Python
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

**Tesseract installieren (macOS):**
```bash
brew install tesseract
```

**Ubuntu/Debian:**
```bash
sudo apt-get update && sudo apt-get install -y tesseract-ocr
```

### Starten
```bash
uvicorn app:app --reload --port 8000
```

## 2) Docker
```bash
docker build -t ad-pretest-mvp .
docker run -p 8000:8000 -v $(pwd)/sample:/app/sample ad-pretest-mvp
```

## 3) API verwenden

**Gesundheitscheck**
```bash
curl http://localhost:8000/health
```

**Bild analysieren**
```bash
curl -X POST http://localhost:8000/analyze/image   -F "file=@sample/ad_example.jpg"   -F "placement=feed"
```

**Antwort (Beispiel)**
```json
{
  "creative_id": "8b2e...",
  "format": "1080x1350",
  "scores": {
    "attention": 81.4,
    "clarity": 73.2,
    "cta_visibility": 69.5,
    "branding": 55.0,
    "readability": 77.0,
    "visual_noise": 68.2
  },
  "metrics": {
    "text_words": 14,
    "text_boxes": 6,
    "contrast_ratio": 6.12,
    "saliency_focus_ratio": 0.72,
    "cta_detected": true,
    "cta_box": [432, 980, 310, 120],
    "logo_detected": false,
    "visual_noise": 0.31
  },
  "heatmap_path": "sample/output/8b2e_heatmap_ad_example.jpg",
  "status": "IMPROVE"
}
```

**Output-Dateien** liegen unter `sample/output/*` (Heatmap-PNG + Raw-Upload).

## 4) Erweiterungen (Next)
- **Logo-Detection:** Template-Matching pro Marke (1–3 Referenz-Logos) → echte Branding-Scores.
- **Saliency-on-Region:** Summe der Saliency in CTA-/Logo-Box anstatt globaler Proxy.
- **Video-Hook:** Frames 0–3s @10fps → Branding Earlyness, Hook-Score.
- **GPT-Empfehlungen:** Vision-Features → 5–7 konkrete, messbare Edits.
- **PDF-Report:** WeasyPrint/ReportLab – 1‑Pager Scorecard.
- **Figma-Webhook:** Exportiertes Artboard → POST /analyze/image → Kommentar mit Ampel + 3 Edits.

## 5) Hinweise
- Das Spectral‑Residual‑Modell ist leichtgewichtig und schnell. Für noch präzisere Heatmaps können DeepGaze/MLNet genutzt werden (größerer Aufwand).
- OCR hängt von Schriftgröße/Kontrast ab. Nutze klare Headline/CTA‑Fonts für verlässliche Ergebnisse.
