import React, { useState } from 'react';
import { Bot, Send, X } from 'lucide-react';
import { aiAPI } from '../services/api';

export default function AIChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Hi! I am your DoorDelight AI Assistant. Ask me about available restaurants, veg dishes, meals under ₹200, or your current order status.',
    },
  ]);

  const sendMessage = async (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
    setInput('');
    setLoading(true);
    try {
      const res = await aiAPI.chat(trimmed);
      setMessages((prev) => [...prev, { role: 'assistant', text: res.data.reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: err.response?.data?.detail || 'Sorry, I could not process that request right now.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="ai-fab"
        onClick={() => setOpen((o) => !o)}
        aria-label="Toggle AI Food Assistant"
      >
        {open ? <X size={24} /> : <Bot size={26} />}
      </button>

      {open && (
        <div className="ai-panel">
          <div
            style={{
              padding: '14px 16px',
              background: 'var(--secondary)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
              <Bot size={18} /> DoorDelight AI Assistant
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ flex: 1, padding: 14, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((m, idx) => (
              <div
                key={idx}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  padding: '10px 12px',
                  borderRadius: 12,
                  fontSize: '0.86rem',
                  whiteSpace: 'pre-wrap',
                  background: m.role === 'user' ? 'var(--primary)' : 'var(--surface-alt)',
                  color: m.role === 'user' ? '#fff' : 'var(--text)',
                }}
              >
                {m.text}
              </div>
            ))}
            {loading && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Thinking...</div>}
          </div>

          <form
            onSubmit={sendMessage}
            style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid var(--border)' }}
          >
            <input
              className="input"
              placeholder="Ask about food, prices, orders..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
