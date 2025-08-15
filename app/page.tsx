'use client';

import { useRef, useState } from 'react';
import Tesseract from 'tesseract.js';
import { computeScores } from '../lib/scoring';

type Scores = ReturnType<typeof computeScores>['scores'];

function relativeLuminance(r:number,g:number,b:number){
  const toLin = (u:number)=>{
    u/=255;
    return u<=0.03928? u/12.92 : Math.pow((u+0.055)/1.055, 2.4);
  };
  const R=toLin(r), G=toLin(g), B=toLin(b);
  return 0.2126*R + 0.7152*G + 0.0722*B;
}

export default function Page() {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ocrWords, setOcrWords] = useState<string[]>([]);
  const [scores, setScores] = useState<Scores | null>(null);
  const [heatmapDataUrl, setHeatmapDataUrl] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heatmapRef = useRef<HTMLCanvasElement>(null);

  const log = (m: string) => setLogs(prev => [...prev, m]);

  const onFile = (f: File | null) => {
    if (!f) return;
    const url = URL.createObjectURL(f);
    setImgUrl(url);
    setScores(null);
    setHeatmapDataUrl(null);
    setOcrWords([]);
    setLogs([]);
  };

  // Simple Laplacian-based "saliency" map -> heat overlay
  const analyze = async () => {
    if (!imgRef.current || !canvasRef.current || !heatmapRef.current) return;
    setBusy(true);
    try {
      const img = imgRef.current;
      const cw = img.naturalWidth;
      const ch = img.naturalHeight;
      const canvas = canvasRef.current;
      canvas.width = cw; canvas.height = ch;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, cw, ch);
      const imageData = ctx.getImageData(0, 0, cw, ch);

      // Grayscale
      const gray = new Uint8ClampedArray(cw * ch);
      for (let i=0, j=0; i<imageData.data.length; i+=4, j++) {
        const r=imageData.data[i], g=imageData.data[i+1], b=imageData.data[i+2];
        gray[j] = (0.299*r + 0.587*g + 0.114*b) | 0;
      }

      // Laplacian magnitude (edge intensity)
      const lap = new Float32Array(cw * ch);
      const k = [[0,1,0],[1,-4,1],[0,1,0]];
      const idx = (x:number,y:number)=> y*cw + x;
      for (let y=1; y<ch-1; y++) {
        for (let x=1; x<cw-1; x++) {
          let v = 0;
          for (let ky=-1; ky<=1; ky++) {
            for (let kx=-1; kx<=1; kx++) {
              const kv = k[ky+1][kx+1];
              if (kv===0) continue;
              v += kv * gray[idx(x+kx,y+ky)];
            }
          }
          lap[idx(x,y)] = Math.abs(v);
        }
      }
      // Normalize
      let maxv = 0;
      for (let i=0;i<lap.length;i++) if (lap[i]>maxv) maxv = lap[i];
      const sal = new Float32Array(lap.length);
      for (let i=0;i<lap.length;i++) sal[i] = maxv ? lap[i]/maxv : 0;

      // Heatmap canvas
      const hcv = heatmapRef.current;
      hcv.width = cw; hcv.height = ch;
      const hctx = hcv.getContext('2d')!;
      const heatImg = hctx.createImageData(cw, ch);
      for (let i=0;i<sal.length;i++) {
        const v = sal[i];
        // simple JET-like palette
        const r = Math.min(255, Math.max(0, 255*(v>0.5? (v-0.5)*2:0)));
        const g = Math.min(255, Math.max(0, v<0.5? 255*(v*2):255*(1-(v-0.5)*2)));
        const b = Math.min(255, Math.max(0, 255*(v<0.5? 1 - v*2:0)));
        const p = i*4;
        heatImg.data[p] = r;
        heatImg.data[p+1] = g;
        heatImg.data[p+2] = b;
        heatImg.data[p+3] = (v*180) | 0; // alpha
      }
      hctx.putImageData(heatImg, 0, 0);

      // OCR via tesseract.js (deu+eng)
      log('Starte OCR…');
      const { data } = await Tesseract.recognize(canvas.toDataURL('image/png'), 'deu+eng');
      const words = (data.words || []).map(w => (w.text||'').trim()).filter(Boolean);
      setOcrWords(words);
      log(`OCR: ${words.length} Wörter`);

      // Approx metrics
      const textWords = words.length;

      // Contrast ratio proxy via sampled luminance (min/max)
      let minL = 1e9, maxL = -1e9;
      const step = Math.max(4, Math.floor(Math.sqrt((cw*ch)/5000)));
      for (let y=0; y<ch; y+=step){
        for (let x=0; x<cw; x+=step){
          const p = (y*cw + x)*4;
          const L = relativeLuminance(imageData.data[p], imageData.data[p+1], imageData.data[p+2]);
          if (L<minL) minL=L;
          if (L>maxL) maxL=L;
        }
      }
      const contrastRatio = (maxL + 0.05) / (minL + 0.05); // 1..21 approx

      // Visual noise proxy: average saliency
      const avgEdge = sal.reduce((a,b)=>a+b,0)/sal.length;
      const visualNoise = Math.max(0, Math.min(1, avgEdge)); // 0..1

      // Safe area focus (center 70%)
      const x0 = Math.floor(cw*0.15), y0 = Math.floor(ch*0.15);
      const x1 = Math.floor(cw*0.85), y1 = Math.floor(ch*0.85);
      let sumAll = 0, sumCenter = 0;
      for (let y=0;y<ch;y++) {
        for (let x=0;x<cw;x++) {
          const v = sal[idx(x,y)];
          sumAll += v;
          if (x>=x0 && x<x1 && y>=y0 && y<y1) sumCenter += v;
        }
      }
      const saliency_focus_ratio = sumAll ? (sumCenter/sumAll) : 0.0;

      const res = computeScores({
        saliency_focus_ratio,
        text_words: textWords,
        visual_noise: visualNoise,
        contrast_ratio: contrastRatio,
      });
      setScores(res.scores);
      setHeatmapDataUrl(hcv.toDataURL('image/png'));
      log('Analyse fertig.');
    } catch (e:any) {
      console.error(e);
      log('Fehler bei der Analyse: ' + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  };

  const downloadJson = () => {
    if (!scores) return;
    const payload = {
      format: imgRef.current ? `${imgRef.current.naturalWidth}x${imgRef.current.naturalHeight}` : null,
      scores
    };
    const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ad-pretest-result.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h1 style={{fontSize:28, fontWeight:700, marginBottom:10}}>Ad-Pretest (Client-only, Vercel-ready)</h1>
      <p style={{opacity:.85, marginBottom:20}}>Lade ein Bild hoch, wir erzeugen eine Heatmap + Scores <i>im Browser</i> (OCR via Tesseract, Saliency via Laplace-Edges).</p>

      <div style={{display:'flex', gap:24, flexWrap:'wrap'}}>
        <div style={{flex:'1 1 380px'}}>
          <label style={{display:'inline-block', padding:'10px 14px', background:'#1f1f22', borderRadius:12, cursor:'pointer'}}>Bild wählen
            <input type="file" accept="image/*" style={{display:'none'}}
              onChange={(e)=> {
                const f = e.target.files?.[0] || null;
                if (!f) return;
                const url = URL.createObjectURL(f);
                setImgUrl(url);
                setScores(null);
                setHeatmapDataUrl(null);
                setOcrWords([]);
                setLogs([]);
                setTimeout(()=>{
                  // draw preview on canvas also
                  const img = imgRef.current;
                  const c = canvasRef.current;
                  if (img && c) {
                    const onload = ()=>{
                      c.width = img.naturalWidth;
                      c.height = img.naturalHeight;
                      const ctx = c.getContext('2d')!;
                      ctx.drawImage(img, 0, 0, c.width, c.height);
                    };
                    img.onload = onload;
                  }
                }, 50);
              }} />
          </label>

          {imgUrl && (
            <div style={{marginTop:16}}>
              <img ref={imgRef} src={imgUrl} alt="preview" style={{maxWidth:'100%', borderRadius:12}} />
            </div>
          )}

          <div style={{marginTop:16}}>
            <button
              onClick={analyze}
              disabled={!imgUrl || busy}
              style={{padding:'10px 14px', borderRadius:12, background: busy? '#3a3a3f':'#6e56cf', border:'none', color:'#fff', cursor: busy? 'not-allowed':'pointer'}}
            >{busy ? 'Analysiere…' : 'Analyse starten'}</button>
            {scores && (
              <button onClick={downloadJson} style={{marginLeft:12, padding:'10px 14px', borderRadius:12, background:'#2e7d32', border:'none', color:'#fff', cursor:'pointer'}}>JSON exportieren</button>
            )}
          </div>

          <div style={{marginTop:16, fontSize:13, opacity:.9}}>
            <strong>Logs</strong>
            <ul>{logs.map((l,i)=><li key={i}>{l}</li>)}</ul>
          </div>
        </div>

        <div style={{flex:'1 1 380px'}}>
          <div style={{display:'grid', gap:12}}>
            <div style={{background:'#141416', padding:12, borderRadius:12}}>
              <strong>Original</strong>
              <canvas ref={canvasRef} style={{width:'100%', borderRadius:8, marginTop:8}}/>
            </div>
            <div style={{background:'#141416', padding:12, borderRadius:12}}>
              <strong>Heatmap</strong>
              <canvas ref={heatmapRef} style={{width:'100%', borderRadius:8, marginTop:8}}/>
              {heatmapDataUrl && <a href={heatmapDataUrl} download="heatmap.png" style={{display:'inline-block', marginTop:8}}>Heatmap speichern</a>}
            </div>
            <div style={{background:'#141416', padding:12, borderRadius:12}}>
              <strong>Scores</strong>
              {scores ? (
                <ul style={{marginTop:8, lineHeight:1.8}}>
                  <li>Attention: {scores.attention.toFixed(1)}</li>
                  <li>Clarity: {scores.clarity.toFixed(1)}</li>
                  <li>CTA Visibility: {scores.cta_visibility.toFixed(1)}</li>
                  <li>Branding (heur.): {scores.branding.toFixed(1)}</li>
                  <li>Readability: {scores.readability.toFixed(1)}</li>
                  <li>Visual Noise (inv): {scores.visual_noise.toFixed(1)}</li>
                  <li>Status: <b>{scores.__status}</b></li>
                </ul>
              ) : <p style={{opacity:.7}}>Noch keine Analyse.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
