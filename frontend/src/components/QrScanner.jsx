import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsQR from 'jsqr';
import { api } from '../api';

export default function QrScanner({ onClose }) {
  const navigate  = useNavigate();
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef    = useRef(null);
  const doneRef   = useRef(false);

  const [status, setStatus]   = useState('starting');
  const [message, setMessage] = useState('');

  const stopCamera = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  };

  useEffect(() => {
    const start = async () => {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch (err) {
        setStatus('error');
        setMessage(
          err.name === 'NotAllowedError'
            ? 'Camera permission denied. Please allow camera access in your browser settings.'
            : `Cannot access camera: ${err.message}`
        );
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) { stream.getTracks().forEach((t) => t.stop()); return; }
      video.srcObject = stream;
      await video.play();
      setStatus('scanning');

      const canvas = canvasRef.current;
      const ctx    = canvas.getContext('2d', { willReadFrequently: true });

      const tick = () => {
        if (doneRef.current) return;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width  = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          const img  = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
          if (code?.data) {
            doneRef.current = true;
            stopCamera();
            handleScan(code.data.trim());
            return;
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    start();
    return stopCamera;
  }, []);

  const handleScan = async (tag) => {
    setStatus('fetching');
    try {
      const assets = await api(`/assets?q=${encodeURIComponent(tag)}`);
      const match  = assets.find((a) => a.asset_tag === tag);
      if (!match) {
        setStatus('error');
        setMessage(`No asset found with tag "${tag}"`);
        return;
      }
      onClose();
      navigate(`/assets/${match.id}`);
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Failed to fetch asset details.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Scan Asset QR Code</h2>
          <button onClick={() => { stopCamera(); onClose(); }}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <div className="relative bg-black" style={{ height: 300 }}>
          <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
          {status === 'scanning' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-52 h-52 border-2 border-white rounded-lg"
                style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)' }} />
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="px-4 py-4 text-center text-sm min-h-16 flex flex-col items-center justify-center gap-2">
          {status === 'starting' && <p className="text-gray-400 animate-pulse">Starting camera…</p>}
          {status === 'scanning' && <p className="text-gray-500">Point the camera at an asset QR code</p>}
          {status === 'fetching' && <p className="text-indigo-600 animate-pulse">QR detected — fetching asset…</p>}
          {status === 'error'    && (
            <>
              <p className="text-red-600">{message}</p>
              <button className="btn text-sm" onClick={() => { stopCamera(); onClose(); }}>Close</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
