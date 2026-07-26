import { useEffect, useRef } from 'react';

// Inline mic-off SVG — no @heroicons/react needed
const MicOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white">
    <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.232.837.92 1.405 1.757 1.405H4.5c.98 0 1.784-.803 1.784-1.784V9.696l1.5-1.5v6.838a1.784 1.784 0 001.784 1.784h.432l6-6V4.06z" />
    <path d="M15.75 7.719V13.5a3.75 3.75 0 01-7.5 0v-1.032l-1.5 1.5V13.5a5.25 5.25 0 0010.5 0V6.219l-1.5 1.5z" />
    <path d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18z" />
  </svg>
);

export default function VideoTile({
  videoTrack,
  audioTrack,
  isLocal = false,
  isScreen = false,
  name = '',
  isMuted = false,
  isVideoOff = false,
  audioLevel = 0,
}) {
  const videoRef = useRef(null);

  // Play video track
  useEffect(() => {
    if (!videoTrack || !videoRef.current) return;
    videoTrack.play(videoRef.current);
    return () => { try { videoTrack.stop(); } catch (_) {} };
  }, [videoTrack]);

  // Play remote audio — never play local (avoids echo)
  useEffect(() => {
    if (!audioTrack || isLocal) return;
    audioTrack.play();
    return () => { try { audioTrack.stop(); } catch (_) {} };
  }, [audioTrack, isLocal]);

  const ringOpacity = Math.min(1, audioLevel / 40);
  const speaking = audioLevel > 5;

  return (
    <div
      className="relative w-full h-full rounded-xl overflow-hidden bg-gray-800 flex items-center justify-center"
      style={{
        outline: speaking ? `2px solid rgba(74,222,128,${ringOpacity})` : 'none',
        transition: 'outline 0.1s',
      }}
    >
      {/* Video element */}
      <div
        ref={videoRef}
        className="absolute inset-0 w-full h-full"
        style={{
          display: videoTrack && !isVideoOff ? 'block' : 'none',
          transform: isLocal && !isScreen ? 'scaleX(-1)' : 'none',
          objectFit: isScreen ? 'contain' : 'cover',
        }}
      />

      {/* Avatar fallback */}
      {(!videoTrack || isVideoOff) && !isScreen && (
        <div className="flex flex-col items-center gap-2 z-10">
          <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-2xl font-bold text-white select-none">
            {name?.[0]?.toUpperCase() || '?'}
          </div>
        </div>
      )}

      {/* Name tag */}
      <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-md z-20 max-w-[80%] truncate">
        {name}
      </div>

      {/* Muted indicator */}
      {isMuted && !isScreen && (
        <div className="absolute top-2 right-2 bg-red-600 rounded-full p-1 z-20">
          <MicOffIcon />
        </div>
      )}
    </div>
  );
}
