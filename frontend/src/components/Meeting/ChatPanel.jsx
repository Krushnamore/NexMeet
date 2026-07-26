import { useState, useEffect, useRef } from 'react';
import api from '../../services/api';

export default function ChatPanel({ meetingId, participants, currentUser, socket, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState(null); // null = public
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);
  const sentIds = useRef(new Set()); // track optimistically added message IDs to avoid duplicates

  // ── LOAD HISTORY ──────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        // FIXED: backend route is GET /api/chat/:meetingId (see README "Chat"
        // section), not /api/meetings/:meetingId/chat — that path 404'd.
        const res = await api.get(`/chat/${meetingId}`);
        const history = (res.data?.messages || res.data || []).map((m) => ({
          ...m,
          _id: m._id || `hist_${m.timestamp || Date.now()}_${Math.random()}`,
        }));
        setMessages(history);
      } catch (err) {
        console.error('Chat history load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [meetingId]);

  // ── INCOMING SOCKET MESSAGES ──────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onMessage = (msg) => {
      // Skip if we already added this message optimistically
      if (sentIds.current.has(msg._id)) {
        sentIds.current.delete(msg._id);
        return;
      }
      setMessages((prev) => [...prev, msg]);
    };

    socket.on('chat:message', onMessage);
    return () => socket.off('chat:message', onMessage);
  }, [socket]);

  // ── AUTO-SCROLL ───────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── SEND ──────────────────────────────────────────────────────────────────
  const handleSend = () => {
    if (!input.trim() || !socket) return;

    const msg = {
      _id: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      content: input.trim(),
      senderName: currentUser?.name,
      senderId: String(currentUser?._id),
      senderAvatar: currentUser?.avatar,
      isPrivate: !!selectedRecipient,
      recipientId: selectedRecipient?.userId || null,
      recipientName: selectedRecipient?.name || null,
      timestamp: new Date().toISOString(),
      isOwn: true,
    };

    // Optimistically add to UI
    sentIds.current.add(msg._id);
    setMessages((prev) => [...prev, msg]);
    setInput('');

    socket.emit('chat:message', {
      meetingId,
      content: msg.content,
      recipientId: msg.recipientId,
      recipientName: msg.recipientName,
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isOwn = (msg) =>
    msg.isOwn || String(msg.senderId) === String(currentUser?._id);

  // Filter: show public messages + private messages involving current user
  const visibleMessages = messages.filter((msg) => {
    if (!msg.isPrivate) return true;
    const uid = String(currentUser?._id);
    return String(msg.senderId) === uid || String(msg.recipientId) === uid;
  });

  return (
    <div className="w-80 flex flex-col bg-gray-800 border-l border-gray-700 h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h2 className="font-semibold text-sm">Chat</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">×</button>
      </div>

      {/* Recipient selector */}
      <div className="px-3 py-2 border-b border-gray-700">
        <label className="text-xs text-gray-400 mb-1 block">Send to</label>
        <select
          className="w-full text-xs bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white"
          value={selectedRecipient?.userId || ''}
          onChange={(e) => {
            const p = participants.find((p) => p.userId === e.target.value);
            setSelectedRecipient(p || null);
          }}
        >
          <option value="">Everyone (public)</option>
          {participants.map((p) => (
            <option key={p.userId} value={p.userId}>
              {p.name} (private)
            </option>
          ))}
        </select>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {loading && <p className="text-center text-gray-500 text-xs mt-4">Loading...</p>}
        {!loading && visibleMessages.length === 0 && (
          <p className="text-center text-gray-500 text-xs mt-4">No messages yet. Say hello! 👋</p>
        )}
        {visibleMessages.map((msg) => (
          <div
            key={msg._id}
            className={`flex flex-col ${isOwn(msg) ? 'items-end' : 'items-start'}`}
          >
            {/* Sender label */}
            {!isOwn(msg) && (
              <span className="text-xs text-gray-400 mb-0.5 px-1">{msg.senderName}</span>
            )}
            {msg.isPrivate && (
              <span className="text-xs text-yellow-400 mb-0.5 px-1">
                {isOwn(msg) ? `→ ${msg.recipientName}` : `🔒 private`}
              </span>
            )}
            <div
              className={`max-w-xs px-3 py-2 rounded-2xl text-sm break-words ${
                isOwn(msg)
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : msg.isPrivate
                  ? 'bg-yellow-800 text-white rounded-bl-sm'
                  : 'bg-gray-700 text-white rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
            <span className="text-xs text-gray-500 mt-0.5 px-1">
              {msg.timestamp
                ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : ''}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-gray-700 flex gap-2">
        <textarea
          rows={1}
          className="flex-1 bg-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-400 resize-none outline-none focus:ring-1 focus:ring-blue-500"
          placeholder={selectedRecipient ? `Message ${selectedRecipient.name}...` : 'Message everyone...'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl px-3 py-2 text-sm transition-colors"
        >
          ➤
        </button>
      </div>
    </div>
  );
}