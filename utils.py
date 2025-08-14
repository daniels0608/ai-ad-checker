import numpy as np
import cv2
from PIL import Image


def ensure_rgb(bgr):
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)


def save_heatmap_png(saliency_map, out_path):
    sal_norm = (saliency_map - saliency_map.min()) / (saliency_map.ptp() + 1e-6)
    sal_8u = (255 * sal_norm).astype('uint8')
    heat = cv2.applyColorMap(sal_8u, cv2.COLORMAP_JET)
    cv2.imwrite(out_path, heat)


def compute_contrast_ratio(img_rgb):
    # WCAG-ähnlicher Approx: mittlere Luminanzen zweier Cluster (KMeans K=2)
    small = cv2.resize(img_rgb, (256, 256), interpolation=cv2.INTER_AREA)
    Z = small.reshape((-1, 3)).astype(np.float32)
    K = 2
    _, labels, centers = cv2.kmeans(Z, K, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 0.5), 3, cv2.KMEANS_PP_CENTERS)
    centers = centers.astype('float32') / 255.0
    # relative luminance
    def rel_lum(c):
        R, G, B = c
        def f(u):
            u = u ** 2.4 if u > 0.03928 else u / 12.92
            return u
        return 0.2126 * f(R) + 0.7152 * f(G) + 0.0722 * f(B)
    L = [rel_lum(centers[0]), rel_lum(centers[1])]
    L1, L2 = max(L), min(L)
    ratio = (L1 + 0.05) / (L2 + 0.05)
    return float(ratio)


def safe_area_mask(shape_hw, placement: str):
    h, w = shape_hw
    mask = np.zeros((h, w), dtype=np.float32)
    # Define central safe areas per placement
    if placement == "story":
        # avoid top/bottom UI bars → central 70%
        y0, y1 = int(0.15*h), int(0.85*h)
        x0, x1 = int(0.1*w), int(0.9*w)
    elif placement == "square":
        y0, y1 = int(0.1*h), int(0.9*h)
        x0, x1 = int(0.1*w), int(0.9*w)
    else:  # feed default (portrait 4:5 / landscape 1.91:1 handled by image itself)
        y0, y1 = int(0.15*h), int(0.85*h)
        x0, x1 = int(0.15*w), int(0.85*w)
    mask[y0:y1, x0:x1] = 1.0
    return mask
