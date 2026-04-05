import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';

const REACTIONS = ['👍', '❤️', '😂', '😮', '👏', '🔥', '✅', '🎉'];

const MessageBubble = ({ msg, isOwn, onPrivateReply }) => (
  <div className={`flex flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'} animate-fadeIn`}>
    {msg.isPrivate && (
      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
        {isOwn ? `Private → ${msg.recipientName}` : `Private from ${msg.senderName}`}
      </span>
    )}
    <div className="flex items-end gap-2" style={{ flexDirection: isOwn ? 'row-reverse' : 'row' }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: 'linear-gradient(135deg, var(--accent), var(--purple))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.6875rem', fontWeight: 700, color: '#fff', fontFamily: 'Syne, sans-serif',
      }}>
        {msg.senderName?.slice(0, 2).toUpperCase()}
      </div>
      <div style={{ maxWidth: '75%' }}>
        <div style={{
          background: isOwn ? 'var(--accent)' : msg.isPrivate ? 'rgba(139,92,246,0.2)' : 'var(--bg-hover)',
          borderRadius: isOwn ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
          border: msg.isPrivate ? '1px solid var(--purple)' : '1px solid var(--border)',
          padding: '8px 12px',
        }}>
          {!isOwn && (
            <p style={{ fontFamily: 'Syne, sans-serif', fontSize: '0.7rem', fontWeight: 700, color: isOwn ? 'rgba(255,255,255,0.8)' : 'var(--accent)', marginBottom: 2 }}>
              {msg.senderName}
            </p>
          )}
          <p style={{ fontSize: '0.875rem', color: isOwn ? '#fff' : 'var(--text-primary)', lineHeight: 1.5, wordBreak: 'break-word' }}>
            {msg.content}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1" style={{ paddingLeft: isOwn ? 0 : 4, justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {format(new Date(msg.timestamp), 'HH:mm')}
          </span>
          {!isOwn && (
            <button onClick={() => onPrivateReply(msg.senderId, msg.senderName)}
              style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              className="hover:text-blue-400 transition-colors">
              Reply privately
            </button>
          )}
        </div>
      </div>
    </div>
  </div>
);

export default function ChatPanel({ socket, meetingId, participants = [] }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [privateRecipient, setPrivateRecipient] = useState(null); // { id, name }
  const [showReactions, setShowReactions] = useState(false);
  const [tab, setTab] = useState('chat'); // chat | participants
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!socket) return;
    const handleMessage = (msg) => {
      setMessages(prev => [...prev, msg]);
    };
    socket.on('chat:message', handleMessage);
    return () => socket.off('chat:message', handleMessage);
  }, [socket]);

  const sendMessage = () => {
    if (!input.trim() || !socket) return;
    socket.emit('chat:message', {
      meetingId,
      content: input.trim(),
      recipientId: privateRecipient?.id || null,
      recipientName: privateRecipient?.name || null,
    });
    setInput('');
    if (privateRecipient) setPrivateRecipient(null);
  };

  const sendReaction = (emoji) => {
    if (!socket) return;
    socket.emit('reaction', { meetingId, emoji });
    setShowReactions(false);
  };

  return (
    <div className="panel" style={{ width: 320 }}>
      {/* Tabs */}
      <div className="flex" style={{ borderBottom: '1px solid var(--border)' }}>
        {[['chat', '💬 Chat'], ['participants', `👥 (${participants.length})`]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex: 1, padding: '12px 8px', border: 'none', background: 'none', cursor: 'pointer',
            fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: '0.8125rem',
            color: tab === key ? 'var(--accent)' : 'var(--text-muted)',
            borderBottom: `2px solid ${tab === key ? 'var(--accent)' : 'transparent'}`,
            transition: 'all 0.2s', marginBottom: -1,
          }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'chat' ? (
        <>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-muted)' }}>
                <span style={{ fontSize: '2rem' }}>💬</span>
                <p style={{ fontSize: '0.875rem', textAlign: 'center' }}>Chat with everyone in the meeting</p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <MessageBubble
                  key={msg._id || i}
                  msg={msg}
                  isOwn={msg.senderId?.toString() === user?._id?.toString()}
                  onPrivateReply={(id, name) => {
                    setPrivateRecipient({ id, name });
                    inputRef.current?.focus();
                  }}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border)' }}>
            {privateRecipient && (
              <div className="flex items-center justify-between mb-2" style={{
                background: 'rgba(139,92,246,0.15)', border: '1px solid var(--purple)',
                borderRadius: 8, padding: '4px 10px', fontSize: '0.75rem', color: 'var(--purple)',
              }}>
                <span>Private → {privateRecipient.name}</span>
                <button onClick={() => setPrivateRecipient(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '1rem' }}>×</button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <div style={{ flex: 1, position: 'relative' }}>
                <textarea
                  ref={inputRef}
                  className="input"
                  style={{ resize: 'none', minHeight: 40, maxHeight: 100, paddingRight: 36, lineHeight: 1.5, fontSize: '0.875rem' }}
                  placeholder={privateRecipient ? `Message ${privateRecipient.name}…` : 'Message everyone…'}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                  }}
                  rows={1}
                />
                <button onClick={() => setShowReactions(p => !p)} style={{
                  position: 'absolute', right: 8, bottom: 8, background: 'none', border: 'none',
                  cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, color: 'var(--text-muted)',
                }}>
                  😊
                </button>
              </div>
              <button className="btn-primary" style={{ padding: '10px 14px', flexShrink: 0 }} onClick={sendMessage} disabled={!input.trim()}>
                ↑
              </button>
            </div>

            {/* Emoji picker */}
            {showReactions && (
              <div className="flex flex-wrap gap-2 mt-2 animate-scaleIn" style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 10, padding: 8,
              }}>
                <p style={{ width: '100%', fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'Syne, sans-serif' }}>Send reaction to all</p>
                {REACTIONS.map(e => (
                  <button key={e} onClick={() => sendReaction(e)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem',
                    padding: '2px 4px', borderRadius: 6, transition: 'transform 0.1s',
                  }} className="hover:scale-125">
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        /* Participants tab */
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
          {participants.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem', fontSize: '0.875rem' }}>
              No participants yet
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {participants.map((p, i) => (
                <div key={p.userId || i} className="flex items-center gap-3" style={{
                  padding: '8px 10px', borderRadius: 10, background: 'var(--bg-card)',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: 'linear-gradient(135deg, var(--accent), var(--purple))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.6875rem', fontWeight: 700, color: '#fff', fontFamily: 'Syne, sans-serif',
                  }}>
                    {(p.name || p.userName)?.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontFamily: 'Syne, sans-serif', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }} className="truncate">
                      {p.name || p.userName}
                      {p.isLocal && ' (You)'}
                    </p>
                    {p.role && <span className={`badge badge-${p.role === 'host' ? 'blue' : p.role === 'co-host' ? 'purple' : 'green'}`} style={{ fontSize: '0.65rem' }}>{p.role}</span>}
                  </div>
                  <div className="flex gap-1">
                    {p.isMuted && <span style={{ fontSize: '0.75rem' }}>🔇</span>}
                    {p.isVideoOff && <span style={{ fontSize: '0.75rem' }}>📷</span>}
                    {p.isHandRaised && <span style={{ fontSize: '0.75rem' }}>✋</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
