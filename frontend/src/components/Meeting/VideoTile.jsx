import { useEffect, useRef } from 'react';

const MicOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white">
    <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5zM6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z"/>
    <path d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06L3.53 2.47z"/>
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
  isPinned = false,
  onPin,
}) {
  const containerRef = useRef(null);

  // Play video into the container div
  useEffect(() => {
    if (!videoTrack || !containerRef.current) return;
    // Small delay ensures DOM is ready
    const timer = setTimeout(() => {
      try {
        videoTrack.play(containerRef.current);
      } catch (err) {
        console.error('videoTrack.play error:', err);
      }
    }, 100);
    return () => {
      clearTimeout(timer);
      try { videoTrack.stop(); } catch (_) {}
    };
  }, [videoTrack]);

  // Play remote audio — never play local (causes echo)
  useEffect(() => {
    if (!audioTrack || isLocal) return;
    try {
      audioTrack.play();
    } catch (err) {
      console.error('audioTrack.play error:', err);
    }
    return () => {
      try { audioTrack.stop(); } catch (_) {}
    };
  }, [audioTrack, isLocal]);

  const speaking = audioLevel > 8;
  const pinnable = !isScreen && typeof onPin === 'function';

  return (
    <div
      className="relative w-full h-full rounded-xl overflow-hidden bg-gray-800 flex items-center justify-center touch-manipulation"
      onClick={pinnable ? onPin : undefined}
      role={pinnable ? 'button' : undefined}
      title={pinnable ? (isPinned ? 'Tap to unpin' : 'Tap to pin') : undefined}
      style={{
        outline: isPinned
          ? '2px solid rgba(96,165,250,0.9)'
          : speaking ? '2px solid rgba(74,222,128,0.8)' : 'none',
        transition: 'outline 0.15s',
        minHeight: '120px',
        cursor: pinnable ? 'pointer' : 'default',
      }}
    >
      {/* Agora renders video into this div */}
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
        style={{
          display: videoTrack && !isVideoOff ? 'block' : 'none',
          transform: isLocal && !isScreen ? 'scaleX(-1)' : 'none',
        }}
      />

      {/* Avatar — shown when no video */}
      {(!videoTrack || isVideoOff) && !isScreen && (
        <div className="z-10 flex flex-col items-center gap-2 px-2">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-blue-600 flex items-center justify-center text-xl sm:text-2xl font-bold text-white select-none">
            {name?.[0]?.toUpperCase() || '?'}
          </div>
          <span className="text-xs text-gray-400 truncate max-w-full">{name}</span>
        </div>
      )}

      {/* Name tag — shown when video is on */}
      {videoTrack && !isVideoOff && (
        <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-md z-20 max-w-[80%] truncate">
          {name}
        </div>
      )}

      {/* Pinned indicator */}
      {isPinned && (
        <div className="absolute top-2 left-2 bg-blue-600/90 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded z-20">
          📌 Pinned
        </div>
      )}

      {/* Muted indicator */}
      {isMuted && !isScreen && (
        <div className="absolute top-2 right-2 bg-red-600 rounded-full p-1 z-20">
          <MicOffIcon />
        </div>
      )}
    </div>
  );
}