import { useState } from 'react';

// ── Inline SVG icons (no @heroicons/react needed) ──────────────────────────
const MicOnIcon  = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z"/><path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z"/></svg>;
const MicOffIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5zM6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z"/><path d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06L3.53 2.47z"/></svg>;
const XIcon      = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd"/></svg>;
const BanIcon    = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd"/></svg>;
const HandIcon   = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M10.5 1.875a1.125 1.125 0 012.25 0v8.219c.517.162 1.006.433 1.425.797l.034.026A4.978 4.978 0 0116.5 14.25v.996a4.5 4.5 0 01-4.5 4.5H12a4.5 4.5 0 01-4.5-4.5v-2.996a1.125 1.125 0 012.25 0v2.996a2.25 2.25 0 002.25 2.25h.001a2.25 2.25 0 002.25-2.25v-.996a2.727 2.727 0 00-.921-2.043l-.034-.026a2.727 2.727 0 00-1.795-.685 1.125 1.125 0 01-1.125-1.125V1.875z"/><path d="M6.75 6.75a1.125 1.125 0 000 2.25v4.503a7.5 7.5 0 0015 0v-4.503a1.125 1.125 0 000-2.25H6.75z"/></svg>;
const KickIcon   = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 006 5.25v13.5a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V15a.75.75 0 011.5 0v3.75a3 3 0 01-3 3h-6a3 3 0 01-3-3V5.25a3 3 0 013-3h6a3 3 0 013 3V9A.75.75 0 0115 9V5.25a1.5 1.5 0 00-1.5-1.5h-6zm10.72 4.72a.75.75 0 011.06 0l3 3a.75.75 0 010 1.06l-3 3a.75.75 0 11-1.06-1.06l1.72-1.72H9a.75.75 0 010-1.5h10.94l-1.72-1.72a.75.75 0 010-1.06z" clipRule="evenodd"/></svg>;
const ShareIcon  = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M13 4.5a2.5 2.5 0 11.702 1.737L6.97 9.604a2.518 2.518 0 010 .792l6.732 3.367a2.5 2.5 0 11-.671 1.341l-6.732-3.367a2.5 2.5 0 110-3.474l6.732-3.367A2.5 2.5 0 0113 4.5z"/></svg>;

export default function ParticipantsPanel({
  meetingId,
  participants = [],
  currentUser,
  isHost,
  handRaisers = [],
  pinnedId = null,
  onTogglePin,
  onMute, onUnmute, onKick, onBan, onUnban,
  onClose,
}) {
  const [bannedLocally, setBannedLocally] = useState(new Set());

  const meetingLink = `${window.location.origin}/join/${meetingId}`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join my NexMeet meeting', url: meetingLink });
        return;
      } catch (_) {
        // user cancelled the native share sheet — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(meetingLink);
      alert('Meeting link copied to clipboard!');
    } catch (_) {
      // last-resort fallback
      prompt('Copy this meeting link:', meetingLink);
    }
  };

  const isHandRaised = (userId) => handRaisers.some((h) => h.userId === userId);

  const handleBan = (userId, name) => {
    if (!confirm(`Permanently ban ${name}?\nThey will NOT be able to rejoin this meeting.`)) return;
    setBannedLocally((prev) => new Set([...prev, userId]));
    onBan?.(userId);
  };

  const handleUnban = (userId) => {
    setBannedLocally((prev) => { const s = new Set(prev); s.delete(userId); return s; });
    onUnban?.(userId);
  };

  const handleKick = (userId, name) => {
    if (!confirm(`Remove ${name} from the meeting?\nThey can rejoin using the meeting link.`)) return;
    onKick?.(userId);
  };

  const allParticipants = [
    {
      userId: String(currentUser?._id),
      name: `${currentUser?.name} (You)`,
      avatar: currentUser?.avatar,
      isYou: true,
      agoraUid: 'local',
    },
    ...participants.filter((p) => p.userId !== String(currentUser?._id)),
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-800 md:static md:inset-auto md:z-auto md:w-72 md:border-l md:border-gray-700 h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h2 className="font-semibold text-sm">
          Participants ({allParticipants.length})
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
          <XIcon />
        </button>
      </div>

      {/* Share meeting */}
      <div className="px-4 py-3 border-b border-gray-700">
        <button
          onClick={handleShare}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 transition-colors rounded-lg px-3 py-2 text-sm font-medium"
        >
          <ShareIcon />
          Share meeting
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-700/40">
        {allParticipants.map((p) => {
          const isBanned = bannedLocally.has(p.userId);
          const handUp   = isHandRaised(p.userId);
          const canPin   = typeof onTogglePin === 'function' && p.agoraUid != null;
          const isPinnedRow = canPin && pinnedId === p.agoraUid;

          return (
            <div
              key={p.userId}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-700/30 transition-colors ${isBanned ? 'opacity-40' : ''}`}
            >
              {/* Avatar + name — tap to pin this participant's video */}
              <button
                type="button"
                disabled={!canPin}
                onClick={() => canPin && onTogglePin(p.agoraUid)}
                title={canPin ? (isPinnedRow ? 'Tap to unpin' : 'Pin this participant\u2019s video') : undefined}
                className={`flex items-center gap-3 flex-1 min-w-0 text-left ${canPin ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className={`w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden ${isPinnedRow ? 'ring-2 ring-blue-400' : ''}`}>
                  {p.avatar
                    ? <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />
                    : p.name?.[0]?.toUpperCase()
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-sm truncate">{p.name}</span>
                    {isPinnedRow  && <span className="text-blue-400" title="Pinned">📌</span>}
                    {handUp      && <span className="text-yellow-400" title="Hand raised"><HandIcon /></span>}
                    {p.isMutedByHost && <span className="text-red-400" title="Muted by host"><MicOffIcon /></span>}
                    {isBanned    && <span className="text-red-500" title="Banned">🚫</span>}
                  </div>
                  {isBanned && <span className="text-xs text-red-400">Banned</span>}
                </div>
              </button>

              {/* Admin actions */}
              {isHost && !p.isYou && (
                <div className="flex items-center gap-1 shrink-0">
                  {/* Mute / Unmute */}
                  {p.isMutedByHost ? (
                    <IconBtn title="Unmute participant" onClick={() => onUnmute?.(p.userId)} className="text-green-400 hover:bg-green-900/30">
                      <MicOnIcon />
                    </IconBtn>
                  ) : (
                    <IconBtn title="Mute participant (they can unmute themselves)" onClick={() => onMute?.(p.userId)} className="text-gray-400 hover:bg-gray-700">
                      <MicOffIcon />
                    </IconBtn>
                  )}

                  {/* Kick — temporary */}
                  {!isBanned && (
                    <IconBtn title="Remove (can rejoin)" onClick={() => handleKick(p.userId, p.name)} className="text-orange-400 hover:bg-orange-900/30">
                      <KickIcon />
                    </IconBtn>
                  )}

                  {/* Ban / Unban */}
                  {isBanned ? (
                    <IconBtn title="Unban" onClick={() => handleUnban(p.userId)} className="text-green-400 hover:bg-green-900/30">
                      <BanIcon />
                    </IconBtn>
                  ) : (
                    <IconBtn title="Ban permanently" onClick={() => handleBan(p.userId, p.name)} className="text-red-400 hover:bg-red-900/30">
                      <BanIcon />
                    </IconBtn>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {isHost && (
        <div className="px-4 py-3 border-t border-gray-700 text-xs text-gray-500 space-y-1">
          <div className="flex items-center gap-2"><MicOffIcon /><span>Mute — they can unmute themselves</span></div>
          <div className="flex items-center gap-2"><KickIcon /><span>Remove — temporary, can rejoin</span></div>
          <div className="flex items-center gap-2"><BanIcon /><span>Ban — permanent, cannot rejoin</span></div>
        </div>
      )}
    </div>
  );
}

function IconBtn({ onClick, title, className, children }) {
  return (
    <button onClick={onClick} title={title} className={`p-1.5 rounded-lg transition-colors ${className}`}>
      {children}
    </button>
  );
}