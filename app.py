from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import uuid
import os

from vision import analyze_image
from scoring import compute_scores

app = FastAPI(title="Ad Pretest MVP", version="0.1.0")

OUTPUT_DIR = os.environ.get("OUTPUT_DIR", "sample/output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

class AnalyzeResponse(BaseModel):
    creative_id: str
    format: Optional[str]
    scores: dict
    metrics: dict
    heatmap_path: str
    status: str

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/analyze/image", response_model=AnalyzeResponse)
async def analyze_image_endpoint(
    file: UploadFile = File(...),
    placement: str = Form("feed"),  # "feed" | "story" | "square"
    expected_width: Optional[int] = Form(None),
    expected_height: Optional[int] = Form(None)
):
    # Persist upload
    cid = str(uuid.uuid4())
    raw_path = os.path.join(OUTPUT_DIR, f"{cid}_raw_{file.filename}")
    with open(raw_path, "wb") as f:
        f.write(await file.read())

    # Vision-Analyse
    v = analyze_image(raw_path, placement=placement, expected_size=(expected_width, expected_height))

    # Scoring
    scores, status = compute_scores(v)

    resp = AnalyzeResponse(
        creative_id=cid,
        format=f"{v['width']}x{v['height']}",
        scores=scores,
        metrics={
            "text_words": v["text_words"],
            "text_boxes": len(v["ocr_boxes"]),
            "contrast_ratio": round(v["contrast_ratio"], 2),
            "saliency_focus_ratio": round(v["saliency_focus_ratio"], 3),
            "cta_detected": v["cta_detected"],
            "cta_box": v.get("cta_box"),
            "logo_detected": v["logo_detected"],
            "visual_noise": round(v["visual_noise"], 3),
        },
        heatmap_path=v["heatmap_path"],
        status=status
    )
    return JSONResponse(resp.model_dump())
