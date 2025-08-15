export function clamp01(x:number){return Math.max(0, Math.min(1, x));}

export function computeScores(v: { saliency_focus_ratio:number, text_words:number, visual_noise:number, contrast_ratio:number }){
  const attention = 100 * clamp01(v.saliency_focus_ratio);
  const textPenalty = Math.min(1, v.text_words/22);
  const noisePenalty = clamp01(v.visual_noise);
  const contrastNorm = Math.max(0, Math.min(1, (v.contrast_ratio - 1)/20));
  const clarity = 100 * (0.45*(1-textPenalty) + 0.25*(1-noisePenalty) + 0.30*contrastNorm);

  // CTA/Branding heuristics (client-only MVP)
  const cta = 55 + 25*(1-noisePenalty); // proxy
  const branding = 55; // neutral baseline

  const readability = 0.6*clarity + 0.4*attention;
  const visualNoiseInv = 100*(1 - clamp01(v.visual_noise));
  const composite = 0.35*attention + 0.25*clarity + 0.20*cta + 0.20*branding;
  const status = composite >= 75 ? 'GO' : (composite >= 60 ? 'IMPROVE' : 'STOP');

  return {
    scores: {
      attention, clarity, cta_visibility: cta, branding, readability, visual_noise: visualNoiseInv,
      __status: status, __raw: v
    },
    status
  };
}
