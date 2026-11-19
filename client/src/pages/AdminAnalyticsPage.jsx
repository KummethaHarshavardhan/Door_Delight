import React, { useEffect, useState } from 'react';
import { Bot, Send } from 'lucide-react';
import { adminAPI, aiAPI } from '../services/api';
import { formatCurrency } from '../utils/formatters';

export default function AdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);
  const [question, setQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    adminAPI.getAnalytics().then((res) => setAnalytics(res.data));
  }, []);

  const handleAskAI = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    try {
      const res = await aiAPI.adminAnalytics(question.trim());
      setAiAnswer(res.data.answer);
    } catch (err) {
      setAiAnswer(err.response?.data?.detail || 'AI Analytics query failed');
    } finally {
      setAsking(false);
    }
  };

  const maxDaily = Math.max(...(analytics?.daily_sales || []).map((d) => d.revenue || 0), 1);
  const maxMonthly = Math.max(...(analytics?.monthly_sales || []).map((m) => m.revenue || 0), 1);

  return (
    <div className="page-enter">
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 18 }}>Business Analytics & AI Insights</h1>

      <div className="card card-glass" style={{ marginBottom: 24, borderColor: 'var(--primary)' }}>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, marginBottom: 10 }}>
            <Bot size={20} color="var(--primary)" /> AI Business Analytics Assistant (Gemini)
          </div>
          <form onSubmit={handleAskAI} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              className="input"
              style={{ flex: '1 1 260px' }}
              placeholder="Ask e.g. 'What is our total revenue and which restaurant has the highest sales?'"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={asking}>
              <Send size={15} /> {asking ? 'Analyzing...' : 'Ask AI'}
            </button>
          </form>
          {aiAnswer && (
            <div style={{ marginTop: 14, padding: 14, background: 'var(--surface-alt)', borderRadius: 12, whiteSpace: 'pre-wrap' }}>
              {aiAnswer}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        <div className="card card-glass">
          <div className="card-body">
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 14 }}>Daily Sales (Last 7 Days)</h2>
            {(analytics?.daily_sales || []).length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No daily sales data yet.</p>
            ) : (
              (analytics?.daily_sales || []).map((d) => (
                <div key={d.date} className="chart-bar-row">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', fontWeight: 700 }}>
                    <span>{d.date} ({d.orders} orders)</span>
                    <span>{formatCurrency(d.revenue)}</span>
                  </div>
                  <div className="chart-bar-track">
                    <div className="chart-bar-fill" style={{ width: `${Math.round((d.revenue / maxDaily) * 100)}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card card-glass">
          <div className="card-body">
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 14 }}>Monthly Sales</h2>
            {(analytics?.monthly_sales || []).length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No monthly sales data yet.</p>
            ) : (
              (analytics?.monthly_sales || []).map((m) => (
                <div key={m.month} className="chart-bar-row">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', fontWeight: 700 }}>
                    <span>{m.month} ({m.orders} orders)</span>
                    <span>{formatCurrency(m.revenue)}</span>
                  </div>
                  <div className="chart-bar-track">
                    <div className="chart-bar-fill" style={{ width: `${Math.round((m.revenue / maxMonthly) * 100)}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
