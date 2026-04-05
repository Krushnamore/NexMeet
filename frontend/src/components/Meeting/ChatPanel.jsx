import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import api from '../../services/api';

const REACTIONS = ['👍', '❤️', '😂', '😮', '👏', '🔥', '✅', '🎉'];

const MessageBubble = ({ msg, isOwn, onPrivateReply }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: isOwn ? 'flex-end' : 'flex-start' }} className="animate-fadeIn">
    {msg.isPrivate && (
      <span style={{ fontSize: '0.65rem', color: 'var(--purple)', fontStyle: 'italic' }}>
        {isOwn ? `Private → ${msg.recipientName}` : `Private from ${msg.senderName}`}
      </span>
    )}
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flexDirection: isOwn ? 'row-reverse' : 'row' }}>
      <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: 'linear-gradient(135deg, var(--accent), var(--purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.625rem', fontWeight: 700, color: '#fff', fontFamily: 'Syne, sans-serif' }}>
        {msg.senderName?.slice(0, 2).toUpperCase()}
      </div>
      <div style={{ maxWidth: '74%' }}>
        <div style={{
          background: isOwn ? 'var(--accent)' : msg.isPrivate ? 'rgba(139,92,246,0.2)' : 'var(--bg-hover)',
          borderRadius: isOwn ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
          border: `1px solid ${msg.isPrivate ? 'var(--purple)' : isOwn ? 'transparent' : 'var(--border)'}`,
          padding: '7px 11px',
        }}>
          {!isOwn && (
            <p style={{ fontFamily: 'Syne, sans-serif', fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent)', marginBottom: 2 }}>
              {msg.senderName}
            </p>
          )}
          <p style={{ fontSize: '0.8125rem', color: isOwn ? '#fff' : 'var(--text-primary)', lineHeight: 1.5, wordBreak: 'break-word' }}>
            {msg.content}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, justifyContent: isOwn ? 'flex-end' : 'flex-start', paddingLeft: isOwn ? 0 : 2 }}>
          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
            {format(new Date(msg.timestamp || Date.now()), 'HH:mm')}
          </span>
          {!isOwn && (
            <button onClick={() => onPrivateReply(msg.senderId, msg.senderName)}
              style={{ fontSize: '0.6rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              Reply privately
            </button>
          )}
        </div>
      </div>
    </div>
  </div>
);

export default function ChatPanel({ socket, meetingId, participants = [], onClose }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [privateRecipient, setPrivateRecipient] = useState(null);
  const [showReactions, setShowReactions] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await api.get(`/chat/${meetingId}`);
        const msgs = res.data.messages.map(m => ({
          _id: m._id,
          content: m.content,
          senderName: m.senderName || m.sender?.name,
          senderId: m.sender?._id || m.sender,
          isPrivate: m.isPrivate,
          recipientName: m.recipientName,
          timestamp: m.createdAt,
        }));
        setMessages(msgs);
      } catch {
        console.warn('Could not load chat history');
      } finally {
        setLoadingHistory(false);
      }
    };
    loadHistory();
  }, [meetingId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!socket) return;
    const handleMessage = (msg) => {
      setMessages(prev => {
        if (prev.find(m => m._id && m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    };
    socket.on('chat:message', handleMessage);
    return () => socket.off('chat:message', handleMessage);
  }, [socket]);

  const sendMessage = useCallback(() => {
    const content = input.trim();
    if (!content || !socket) return;
    socket.emit('chat:message', {
      meetingId,
      content,
      recipientId: privateRecipient?.id || null,
      recipientName: privateRecipient?.name || null,
    });
    setMessages(prev => [...prev, {
      _id: Date.now().toString(),
      content,
      senderName: user?.name,
      senderId: user?._id,
      isPrivate: !!privateRecipient,
      recipientName: privateRecipient?.name,
      timestamp: new Date().toISOString(),
    }]);
    setInput('');
    setPrivateRecipient(null);
  }, [input, socket, meetingId, privateRecipient, user]);

  const sendReaction = (emoji) => {
    if (!socket) return;
    socket.emit('reaction', { meetingId, emoji });
    setShowReactions(false);
  };

  return (
    <div style={{ height: '100%', background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>Chat</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.25rem', lineHeight: 1 }}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loadingHistory ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1rem' }}>Loading messages…</div>
        ) : messages.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-muted)', padding: '2rem' }}>
            <span style={{ fontSize: '2rem' }}>💬</span>
            <p style={{ fontSize: '0.8125rem', textAlign: 'center' }}>No messages yet. Say hello!</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <MessageBubble
              key={msg._id || i}
              msg={msg}
              isOwn={msg.senderId?.toString() === user?._id?.toString()}
              onPrivateReply={(id, name) => { setPrivateRecipient({ id, name }); inputRef.current?.focus(); }}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '10px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        {privateRecipient && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(139,92,246,0.15)', border: '1px solid var(--purple)', borderRadius: 8, padding: '4px 10px', marginBottom: 8, fontSize: '0.72rem', color: 'var(--purple)' }}>
            <span>Private → {privateRecipient.name}</span>
            <button onClick={() => setPrivateRecipient(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '1rem' }}>×</button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <textarea
              ref={inputRef}
              className="input"
              style={{ resize: 'none', minHeight: 38, maxHeight: 90, paddingRight: 34, lineHeight: 1.5, fontSize: '0.8125rem' }}
              placeholder={privateRecipient ? `Message ${privateRecipient.name}…` : 'Message everyone…'}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              rows={1}
            />
            <button onClick={() => setShowReactions(p => !p)} style={{ position: 'absolute', right: 8, bottom: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, color: 'var(--text-muted)' }}>
              😊
            </button>
          </div>
          <button className="btn-primary" style={{ padding: '9px 13px', flexShrink: 0, fontSize: '0.875rem' }} onClick={sendMessage} disabled={!input.trim()}>↑</button>
        </div>

        {showReactions && (
          <div className="animate-scaleIn" style={{ marginTop: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <p style={{ width: '100%', fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'Syne, sans-serif', marginBottom: 2 }}>Send reaction to all</p>
            {REACTIONS.map(e => (
              <button key={e} onClick={() => sendReaction(e)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.375rem', padding: '2px 4px', borderRadius: 6 }}>{e}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}