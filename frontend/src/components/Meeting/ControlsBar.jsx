import { useState } from 'react';

// ── Inline SVG icons — zero external dependencies ─────────────────────────────
const MicOnSVG  = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z"/><path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z"/></svg>;
const MicOffSVG = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5zM6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z"/><path d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06L3.53 2.47z"/></svg>;
const CamOnSVG  = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M4.5 4.5a3 3 0 00-3 3v9a3 3 0 003 3h8.25a3 3 0 003-3v-9a3 3 0 00-3-3H4.5zM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06z"/></svg>;
const CamOffSVG = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18zM22.5 17.69c0 .471-.202.902-.533 1.204L7.946 4.83A3 3 0 0110.5 4.5h8.25a3 3 0 013 3v10.19zm-4.16-11.53L4.905 19.594A3 3 0 011.5 16.5v-9a3 3 0 013-3H18.34z"/></svg>;
const ScreenSVG = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M2.25 5.25a3 3 0 013-3h13.5a3 3 0 013 3V15a3 3 0 01-3 3h-3v.257c0 .597.237 1.17.659 1.591l.621.622a.75.75 0 01-.53 1.28h-9a.75.75 0 01-.53-1.28l.621-.622a2.25 2.25 0 00.659-1.59V18h-3a3 3 0 01-3-3V5.25zm1.5 0v9.75c0 .83.67 1.5 1.5 1.5h13.5c.83 0 1.5-.67 1.5-1.5V5.25c0-.83-.67-1.5-1.5-1.5H5.25c-.83 0-1.5.67-1.5 1.5z" clipRule="evenodd"/></svg>;
const ChatSVG   = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97z" clipRule="evenodd"/></svg>;
const PeopleSVG = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M4.5 6.375a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0zM14.25 8.625a3.375 3.375 0 116.75 0 3.375 3.375 0 01-6.75 0zM1.5 19.125a7.125 7.125 0 0114.25 0v.003l-.001.119a.75.75 0 01-.363.63 13.067 13.067 0 01-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 01-.364-.63l-.001-.122zM17.25 19.128l-.001.144a2.25 2.25 0 01-.233.96 10.088 10.088 0 005.06-1.01.75.75 0 00.42-.643 4.875 4.875 0 00-6.957-4.611 8.586 8.586 0 011.71 5.157v.003z"/></svg>;
const HandSVG   = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M10.5 1.875a1.125 1.125 0 012.25 0v8.219c.517.162 1.006.433 1.425.797l.034.026A4.978 4.978 0 0116.5 14.25v.996a4.5 4.5 0 01-4.5 4.5H12a4.5 4.5 0 01-4.5-4.5v-2.996a1.125 1.125 0 012.25 0v2.996a2.25 2.25 0 002.25 2.25h.001a2.25 2.25 0 002.25-2.25v-.996a2.727 2.727 0 00-.921-2.043l-.034-.026a2.727 2.727 0 00-1.795-.685 1.125 1.125 0 01-1.125-1.125V1.875z"/></svg>;
const LeaveSVG  = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 006 5.25v13.5a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V15a.75.75 0 011.5 0v3.75a3 3 0 01-3 3h-6a3 3 0 01-3-3V5.25a3 3 0 013-3h6a3 3 0 013 3V9A.75.75 0 0115 9V5.25a1.5 1.5 0 00-1.5-1.5h-6zm5.03 4.72a.75.75 0 010 1.06l-1.72 1.72h10.94a.75.75 0 010 1.5H10.81l1.72 1.72a.75.75 0 11-1.06 1.06l-3-3a.75.75 0 010-1.06l3-3a.75.75 0 011.06 0z" clipRule="evenodd"/></svg>;

// ── Device detection ──────────────────────────────────────────────────────────
const isIOS     = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isAndroid = () => /Android/i.test(navigator.userAgent);

const EMOJIS = ['👍', '❤️', '😂', '😮', '👏', '🎉'];

export default function ControlsBar({
  isMuted, isVideoOff, isScreenSharing,
  audioLevel = 0,
  unreadChat = 0,
  handRaisers = [],
  showChat, showParticipants,
  onToggleMute, onToggleVideo, onScreenShare,
  onReaction, onHandRaise,
  onToggleChat, onToggleParticipants,
  onLeave,
}) {
  const [showReactions, setShowReactions] = useState(false);
  const [handRaised,    setHandRaised]    = useState(false);

  const handleHandRaise = () => {
    const next = !handRaised;
    setHandRaised(next);
    onHandRaise?.(next);
  };

  // iOS: blocked entirely. Android: allowed (tab capture). Desktop: full share.
  const screenShareDisabled = isIOS();
  const screenShareTooltip  = isIOS()
    ? 'Not supported on iPhone/iPad — Apple restriction'
    : isAndroid()
    ? 'Android: shares current browser tab only (Chrome required)'
    : isScreenSharing
    ? 'Stop sharing'
    : 'Share your screen';

  // Volume bar: 0-100 fills left→right (correct, not reversed)
  const volumeBarWidth = `${Math.min(100, Math.max(0, audioLevel))}%`;

  return (
    <div className="relative bg-gray-900 border-t border-gray-700 px-4 py-3">

      {/* Audio level bar — sits at the very top of the controls strip */}
      {!isMuted && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gray-700">
          <div
            className="h-full bg-green-500 transition-all duration-100"
            style={{ width: volumeBarWidth }}
          />
        </div>
      )}

      <div className="flex items-center justify-between max-w-2xl mx-auto">

        {/* Mute / Unmute */}
        <Btn
          onClick={onToggleMute}
          label={isMuted ? 'Unmute' : 'Mute'}
          danger={isMuted}
          active={!isMuted}
          title={isMuted ? 'Click to unmute' : 'Click to mute'}
        >
          {isMuted ? <MicOffSVG /> : <MicOnSVG />}
        </Btn>

        {/* Camera on / off */}
        <Btn
          onClick={onToggleVideo}
          label={isVideoOff ? 'Start video' : 'Stop video'}
          danger={isVideoOff}
          active={!isVideoOff}
          title={isVideoOff ? 'Turn camera on' : 'Turn camera off'}
        >
          {isVideoOff ? <CamOffSVG /> : <CamOnSVG />}
        </Btn>

        {/* Screen share
            - iOS:     disabled button, tooltip explains why
            - Android: enabled, shows tab-capture warning in tooltip
            - Desktop: full screen/window/tab picker                 */}
        <Btn
          onClick={onScreenShare}
          label={isScreenSharing ? 'Stop share' : 'Share'}
          active={isScreenSharing}
          highlight={isScreenSharing}
          disabled={screenShareDisabled}
          title={screenShareTooltip}
        >
          <ScreenSVG />
        </Btn>

        {/* Emoji reactions */}
        <div className="relative">
          <Btn
            onClick={() => setShowReactions((v) => !v)}
            label="React"
            active={showReactions}
          >
            <span className="text-xl leading-none">😊</span>
          </Btn>
          {showReactions && (
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-600 rounded-2xl px-3 py-2 flex gap-2 shadow-xl z-50">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onReaction?.(emoji);
                    setShowReactions(false);
                  }}
                  className="text-2xl hover:scale-125 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Raise / Lower hand */}
        <Btn
          onClick={handleHandRaise}
          label={handRaised ? 'Lower' : 'Hand'}
          active={handRaised}
          highlight={handRaised}
          badge={handRaisers.length > 0 ? handRaisers.length : null}
          title={handRaised ? 'Lower hand' : 'Raise hand'}
        >
          <HandSVG />
        </Btn>

        {/* Chat */}
        <Btn
          onClick={onToggleChat}
          label="Chat"
          active={showChat}
          badge={unreadChat > 0 ? unreadChat : null}
          title="Open chat"
        >
          <ChatSVG />
        </Btn>

        {/* Participants */}
        <Btn
          onClick={onToggleParticipants}
          label="People"
          active={showParticipants}
          title="Show participants"
        >
          <PeopleSVG />
        </Btn>

        {/* Leave */}
        <button
          onClick={onLeave}
          title="Leave meeting"
          className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors"
        >
          <LeaveSVG />
          <span className="text-xs">Leave</span>
        </button>
      </div>
    </div>
  );
}

// ── Reusable control button ───────────────────────────────────────────────────
function Btn({ onClick, label, active, danger, highlight, disabled, badge, title, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all
        ${disabled
          ? 'opacity-40 cursor-not-allowed text-gray-500'
          : 'cursor-pointer hover:bg-gray-700'
        }
        ${!disabled && active && !danger && !highlight ? 'text-white'   : ''}
        ${!disabled && !active && !danger             ? 'text-gray-400' : ''}
        ${!disabled && danger                         ? 'bg-red-900/40 text-red-400 hover:bg-red-900/60' : ''}
        ${!disabled && highlight                      ? 'bg-blue-900/40 text-blue-400' : ''}
      `}
    >
      {children}
      <span className="text-xs whitespace-nowrap">{label}</span>
      {badge != null && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}