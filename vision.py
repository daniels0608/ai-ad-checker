import cv2
import numpy as np
from PIL import Image
import pytesseract
import os
from skimage import color, filters
from utils import ensure_rgb, save_heatmap_png, compute_contrast_ratio, safe_area_mask

CTA_KEYWORDS = [
    "jetzt", "shop", "kaufen", "mehr", "info", "anmelden", "subscribe", "buy", "learn", "mehr erfahren"
]


def spectral_residual_saliency(img_bgr: np.ndarray) -> np.ndarray:
    # OpenCV Spectral Residual Saliency (fast, no training)
    sal = cv2.saliency.StaticSaliencySpectralResidual_create()
    success, saliency_map = sal.computeSaliency(img_bgr)
    if not success:
        # Fallback: Laplacian variance
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        saliency_map = cv2.Laplacian(gray, cv2.CV_64F)
        saliency_map = np.abs(saliency_map)
        saliency_map = (saliency_map - saliency_map.min()) / (saliency_map.ptp() + 1e-6)
    return saliency_map.astype("float32")


def extract_ocr(img_rgb: np.ndarray):
    # Use Tesseract to extract text and boxes
    pil = Image.fromarray(img_rgb)
    data = pytesseract.image_to_data(pil, output_type=pytesseract.Output.DICT, lang='deu+eng')
    words = []
    boxes = []
    for i, text in enumerate(data.get('text', [])):
        if text and text.strip():
            x, y, w, h = data['left'][i], data['top'][i], data['width'][i], data['height'][i]
            words.append(text.strip().lower())
            boxes.append((x, y, w, h, text.strip()))
    return words, boxes


def detect_cta(ocr_words, ocr_boxes, w, h):
    # Heuristik: Wenn Wort in CTA_KEYWORDS vorkommt, nimm dessen Box.
    # Optional: combine nearby boxes into a rectangle.
    idx = None
    for i, wtxt in enumerate(ocr_words):
        if any(k in wtxt for k in CTA_KEYWORDS):
            idx = i
            break
    if idx is None:
        return False, None
    x, y, bw, bh, _ = ocr_boxes[idx]
    # Expand a bit to approximate a button shape
    pad = int(0.1 * max(bw, bh))
    x2 = max(0, x - pad)
    y2 = max(0, y - pad)
    bw2 = min(w - x2, bw + 2 * pad)
    bh2 = min(h - y2, bh + 2 * pad)
    return True, (int(x2), int(y2), int(bw2), int(bh2))


def estimate_visual_noise(img_rgb: np.ndarray):
    # Proxy: Edge density + color cluster count
    gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 100, 200)
    edge_density = edges.mean()  # 0..1
    # Color clusters via kmeans on a small sample
    sample = cv2.resize(img_rgb, (128, 128), interpolation=cv2.INTER_AREA)
    Z = sample.reshape((-1, 3)).astype(np.float32)
    K = 5
    _, labels, _ = cv2.kmeans(Z, K, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0), 3, cv2.KMEANS_PP_CENTERS)
    cluster_var = np.var(np.bincount(labels.flatten(), minlength=K) / labels.size)
    noise = 0.6 * edge_density + 0.4 * (1 - cluster_var)  # higher = noisier
    return float(noise)


def analyze_image(path: str, placement: str = "feed", expected_size=(None, None)):
    bgr = cv2.imread(path, cv2.IMREAD_COLOR)
    assert bgr is not None, f"Cannot read image: {path}"
    h, w = bgr.shape[:2]
    rgb = ensure_rgb(bgr)

    # Saliency
    sal = spectral_residual_saliency(bgr)
    # Focus ratio in central safe area (variiert je placement)
    mask = safe_area_mask((h, w), placement)
    focus_ratio = float((sal * mask).sum() / (sal.sum() + 1e-6))

    # Heatmap export
    heatmap_path = path.replace("_raw_", "_heatmap_")
    save_heatmap_png(sal, heatmap_path)

    # OCR
    words, boxes = extract_ocr(rgb)

    # CTA detection
    cta_detected, cta_box = detect_cta(words, boxes, w, h)

    # Contrast proxy
    contrast_ratio = compute_contrast_ratio(rgb)

    # Visual noise
    noise = estimate_visual_noise(rgb)

    # Logo detection (MVP: not implemented → False)
    logo_detected = False

    return {
        "width": w,
        "height": h,
        "saliency_focus_ratio": focus_ratio,
        "heatmap_path": heatmap_path,
        "ocr_words": words,
        "ocr_boxes": boxes,
        "text_words": len(words),
        "cta_detected": cta_detected,
        "cta_box": cta_box,
        "contrast_ratio": contrast_ratio,
        "visual_noise": noise,
        "logo_detected": logo_detected,
        "placement": placement,
    }
