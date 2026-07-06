"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Rewind, FastForward } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

// Imo-ishoralar bilan boshqariladigan video pleer.
// Tugmalar yo'q. Barcha amallar gesture orqali:
//   • Bitta bosish (tap) — ijro / to'xtatish
//   • Chap yarim ikki marta bosish — 10 soniya orqaga
//   • O'ng yarim ikki marta bosish — 10 soniya oldinga
//   • Yon (chap-o'ng) surish — seek (o'tqazish)
//   • Yuqori-past surish — ovoz (unmute)
// Autoplay: mute holatida (brauzer talab qiladi). Foydalanuvchi yuqoriga surganda unmute.
// Fullscreen va yorug'lik yo'q — controlsList orqali cheklangan.

type FlashKind = "play" | "pause" | "skipBack" | "skipFwd" | "seek" | "volume";

export function GesturePlayer({
  src,
  poster,
  className,
}: {
  src: string;
  poster?: string | null;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [volume, setVolume] = useState(0);
  const [muted, setMuted] = useState(true);
  const [flash, setFlash] = useState<{ kind: FlashKind; value?: number } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Gesture holati
  const g = useRef({
    startX: 0,
    startY: 0,
    startTime: 0,
    startPos: 0,
    startVol: 0,
    lastTapAt: 0,
    lastTapSide: null as "left" | "right" | null,
    dragMode: null as null | "seek" | "volume",
    active: false,
    width: 0,
    height: 0,
  });

  const showFlash = useCallback((f: { kind: FlashKind; value?: number } | null) => {
    setFlash(f);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    if (f) flashTimer.current = setTimeout(() => setFlash(null), 800);
  }, []);

  // Autoplay muted
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.volume = 0;
    v.play().catch(() => {});
  }, [src]);

  // Video hodisalari
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrent(v.currentTime);
    const onDur = () => setDuration(v.duration || 0);
    const onVol = () => {
      setVolume(v.volume);
      setMuted(v.muted);
    };
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("durationchange", onDur);
    v.addEventListener("volumechange", onVol);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("durationchange", onDur);
      v.removeEventListener("volumechange", onVol);
    };
  }, []);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      showFlash({ kind: "play" });
    } else {
      v.pause();
      showFlash({ kind: "pause" });
    }
  }

  function skip(delta: number) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta));
    showFlash({ kind: delta < 0 ? "skipBack" : "skipFwd" });
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const v = videoRef.current;
    g.current = {
      startX: e.clientX - rect.left,
      startY: e.clientY - rect.top,
      startTime: Date.now(),
      startPos: v?.currentTime ?? 0,
      startVol: v?.volume ?? 0,
      lastTapAt: g.current.lastTapAt,
      lastTapSide: g.current.lastTapSide,
      dragMode: null,
      active: true,
      width: rect.width,
      height: rect.height,
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const s = g.current;
    if (!s.active) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dx = x - s.startX;
    const dy = y - s.startY;

    if (!s.dragMode) {
      if (Math.abs(dx) > 12 || Math.abs(dy) > 12) {
        s.dragMode = Math.abs(dx) > Math.abs(dy) ? "seek" : "volume";
      } else {
        return;
      }
    }

    const v = videoRef.current;
    if (!v) return;

    if (s.dragMode === "seek") {
      // Butun kenglik = ±60 soniya
      const maxSeek = Math.min(v.duration || 60, 60);
      const seekAmount = (dx / s.width) * maxSeek;
      const newTime = Math.max(0, Math.min(v.duration || 0, s.startPos + seekAmount));
      v.currentTime = newTime;
      setFlash({ kind: "seek", value: newTime });
    } else {
      // Yuqoriga = ovoz + (dy manfiy)
      const change = -dy / s.height;
      const newVol = Math.max(0, Math.min(1, s.startVol + change));
      v.volume = newVol;
      v.muted = newVol === 0;
      setFlash({ kind: "volume", value: newVol });
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const s = g.current;
    if (!s.active) return;
    s.active = false;
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (s.dragMode) {
      // Drag tugadi — flash o'chishini kutamiz
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(null), 900);
      return;
    }

    const dt = Date.now() - s.startTime;
    if (dt > 350) return;

    const side: "left" | "right" = s.startX < s.width / 2 ? "left" : "right";
    const now = Date.now();

    // Double tap tekshirish
    if (s.lastTapAt && now - s.lastTapAt < 320 && s.lastTapSide === side) {
      if (singleTapTimer.current) {
        clearTimeout(singleTapTimer.current);
        singleTapTimer.current = null;
      }
      skip(side === "left" ? -10 : 10);
      s.lastTapAt = 0;
      s.lastTapSide = null;
      return;
    }

    // Single tap — 260ms kutamiz, agar double kelmasa toggle
    s.lastTapAt = now;
    s.lastTapSide = side;
    if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
    singleTapTimer.current = setTimeout(() => {
      if (g.current.lastTapAt === now) {
        togglePlay();
        g.current.lastTapAt = 0;
        g.current.lastTapSide = null;
      }
      singleTapTimer.current = null;
    }, 260);
  }

  return (
    <div className={`relative w-full h-full ${className ?? ""}`} data-protected="true">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        src={src}
        poster={poster ?? undefined}
        muted={muted}
        playsInline
        autoPlay
        loop
        controlsList="nodownload noremoteplayback nofullscreen"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
        draggable={false}
        className="w-full h-full object-contain select-none"
      />

      {/* Gesture qatlami (video ustida) */}
      <div
        className="absolute inset-0 z-20 touch-none cursor-pointer"
        style={{ WebkitTapHighlightColor: "transparent" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />

      {/* Pastdagi ingichka progress chizigi — informatsion, boshqarilmaydi */}
      <div className="absolute left-0 right-0 bottom-0 h-[3px] bg-white/10 z-30 pointer-events-none">
        <div
          className="h-full bg-[var(--accent)] transition-[width] duration-100"
          style={{ width: `${duration ? (current / duration) * 100 : 0}%` }}
        />
      </div>

      {/* Vaqt indikatori — pastki-o'ng burchakda mono */}
      <div className="absolute bottom-2 right-2 z-30 meta text-[10px] text-white/70 pointer-events-none">
        {formatTime(current)} · {formatTime(duration)}
      </div>

      {/* Feedback */}
      <AnimatePresence>
        {flash && <FeedbackOverlay flash={flash} duration={duration} />}
      </AnimatePresence>
    </div>
  );
}

function FeedbackOverlay({
  flash,
  duration,
}: {
  flash: { kind: FlashKind; value?: number };
  duration: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.18, ease: [0.2, 0.6, 0.2, 1] }}
      className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
    >
      {flash.kind === "play" && <CenterIcon icon={<Play size={40} strokeWidth={1.5} fill="currentColor" />} />}
      {flash.kind === "pause" && <CenterIcon icon={<Pause size={40} strokeWidth={1.5} fill="currentColor" />} />}
      {flash.kind === "skipBack" && (
        <CenterIcon icon={<Rewind size={36} strokeWidth={1.5} />} label="−10s" />
      )}
      {flash.kind === "skipFwd" && (
        <CenterIcon icon={<FastForward size={36} strokeWidth={1.5} />} label="+10s" />
      )}
      {flash.kind === "seek" && (
        <SeekBar current={flash.value ?? 0} duration={duration} />
      )}
      {flash.kind === "volume" && <VolumeBar value={flash.value ?? 0} />}
    </motion.div>
  );
}

function CenterIcon({ icon, label }: { icon: React.ReactNode; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 bg-black/60 backdrop-blur-md rounded-full w-24 h-24 justify-center text-white">
      {icon}
      {label && <span className="meta text-[10px] text-white">{label}</span>}
    </div>
  );
}

function SeekBar({ current, duration }: { current: number; duration: number }) {
  const pct = duration ? (current / duration) * 100 : 0;
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-4 bg-black/60 backdrop-blur-md rounded-[var(--r-card)] min-w-[240px] max-w-[70%]">
      <div className="meta text-white text-[11px]">
        {formatTime(current)} / {formatTime(duration)}
      </div>
      <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
        <div className="h-full bg-[var(--accent)] transition-[width] duration-100" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function VolumeBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-4 bg-black/60 backdrop-blur-md rounded-[var(--r-card)]">
      <div className="w-1.5 h-32 bg-white/20 rounded-full relative overflow-hidden">
        <div
          className="absolute bottom-0 left-0 right-0 bg-[var(--accent)] transition-[height] duration-100"
          style={{ height: `${pct}%` }}
        />
      </div>
      <div className="flex items-center gap-1 text-white meta">
        {value === 0 ? <VolumeX size={12} strokeWidth={1.5} /> : <Volume2 size={12} strokeWidth={1.5} />}
        {pct}%
      </div>
    </div>
  );
}

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
  const mm = Math.floor(s / 60);
  const ss = String(Math.floor(s % 60)).padStart(2, "0");
  return `${mm}:${ss}`;
}
