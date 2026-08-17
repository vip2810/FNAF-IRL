import { useEffect, useRef } from 'react';
import { cameraCssFilter } from '../lib/types';
import type { PublicConfig } from '../lib/types';

/** Simulated CCTV static noise for cameras without a real RTSP stream. */
function MockFeed({ label, filter }: { label: string; filter: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const w = 320;
    const h = 180;
    canvas.width = w;
    canvas.height = h;
    const image = ctx.createImageData(w, h);
    const draw = () => {
      const data = image.data;
      for (let i = 0; i < data.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        data[i] = v * 0.55;
        data[i + 1] = v * 0.6;
        data[i + 2] = v * 0.55;
        data[i + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, w, h);
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="camera-feed mock">
      <canvas ref={canvasRef} style={{ filter }} />
      <div className="camera-feed-label">{label} — SIGNAL SIMULÉ</div>
    </div>
  );
}

export default function CameraView({ camId, config }: { camId: string; config: PublicConfig }) {
  const camera = config.cameras.find((c) => c.id === camId);
  const label = camera?.name ?? camId;
  const filter = cameraCssFilter(camera?.filters);
  const isReal = config.streamingCamIds.includes(camId) && config.go2rtcRunning;

  if (!isReal) return <MockFeed label={label} filter={filter} />;

  const src = `${config.go2rtcUrl}/stream.html?src=${encodeURIComponent(camId)}&mode=webrtc,mse`;
  return (
    <div className="camera-feed">
      <iframe src={src} title={label} allow="autoplay" style={{ filter }} />
      <div className="camera-feed-label">{label}</div>
    </div>
  );
}
