from typing import Dict, Tuple

# Gewichte kannst Du je Kunde anpassen
WEIGHTS = {
    "attention": 0.35,
    "clarity": 0.25,
    "cta": 0.20,
    "branding": 0.20,
}


def clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def attention_score(focus_ratio: float) -> float:
    # focus_ratio: Anteil der Saliency in Safe Area (0..1)
    return 100.0 * clamp01(focus_ratio)


def clarity_score(text_words: int, visual_noise: float, contrast_ratio: float) -> float:
    # Heuristik: wenig Text + hohe Kontraste + wenig Noise = klar
    # Normierungen/Bounds
    text_penalty = min(1.0, text_words / 22.0)   # > ~22 Wörter wird stark bestraft
    noise_penalty = clamp01(visual_noise)        # already 0..1 approx
    # Kontrast (WCAG-like): 1:1 .. 21:1 → normieren
    contrast_norm = max(0.0, min(1.0, (contrast_ratio - 1.0) / 20.0))
    score = 100.0 * (0.45 * (1 - text_penalty) + 0.25 * (1 - noise_penalty) + 0.30 * contrast_norm)
    return score


def cta_visibility_score(cta_detected: bool, cta_area_ratio: float, cta_center_dist: float, saliency_on_cta: float) -> float:
    if not cta_detected:
        return 35.0  # Soft-Fail, damit nicht 0
    # cta_area_ratio: Fläche CTA vs Bild (0..0.2 sinnvoll)
    area_component = min(1.0, cta_area_ratio / 0.035)  # Ziel: ~3.5% der Fläche
    # cta_center_dist: Distanz CTA zum Bildzentrum (0..1, kleiner besser)
    center_component = 1.0 - clamp01(cta_center_dist)
    sal_component = clamp01(saliency_on_cta)
    score = 100.0 * (0.5 * sal_component + 0.3 * area_component + 0.2 * center_component)
    return score


def branding_score(logo_detected: bool, saliency_logo: float = 0.0, logo_area_ratio: float = 0.0) -> float:
    if not logo_detected:
        # Mild penalty, encourage early branding later
        return 55.0
    score = 100.0 * (0.7 * clamp01(saliency_logo) + 0.3 * min(1.0, logo_area_ratio / 0.025))
    return score


def compute_scores(vdict: Dict) -> Tuple[Dict, str]:
    # Attention
    attention = attention_score(vdict["saliency_focus_ratio"])  # 0..100

    # Clarity
    clarity = clarity_score(vdict["text_words"], vdict["visual_noise"], vdict["contrast_ratio"])  # 0..100

    # CTA metrics (approx)
    if vdict["cta_detected"] and vdict["cta_box"] is not None:
        x, y, w, h = vdict["cta_box"]
        img_area = vdict["width"] * vdict["height"]
        area_ratio = (w * h) / max(1, img_area)
        # center distance (0..1)
        cx = x + w / 2
        cy = y + h / 2
        dx = abs(cx - vdict["width"] / 2) / (vdict["width"] / 2)
        dy = abs(cy - vdict["height"] / 2) / (vdict["height"] / 2)
        center_dist = min(1.0, (dx**2 + dy**2) ** 0.5)
        # saliency on CTA (approx: use focus ratio as proxy)
        sal_on_cta = 0.8  # MVP: optimistic default; replace with region sum
        cta = cta_visibility_score(True, area_ratio, center_dist, sal_on_cta)
    else:
        cta = cta_visibility_score(False, 0.0, 1.0, 0.0)

    # Branding (MVP: logo not detected → 55)
    branding = branding_score(vdict["logo_detected"])  # extend later with saliency & area

    scores = {
        "attention": round(attention, 1),
        "clarity": round(clarity, 1),
        "cta_visibility": round(cta, 1),
        "branding": round(branding, 1),
        "readability": round(0.6 * clarity + 0.4 * attention, 1),  # Zusatzmetrik
        "visual_noise": round(100.0 * (1 - max(0.0, min(1.0, vdict["visual_noise"]))), 1)
    }

    # Ampel
    composite = 0.35 * attention + 0.25 * clarity + 0.20 * cta + 0.20 * branding
    status = "GO" if composite >= 75 else ("IMPROVE" if composite >= 60 else "STOP")

    return scores, status
