import React, { useState, useRef, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
  AreaChart, Area, ReferenceLine,
} from 'recharts';
import { Send, User, Bot, Loader2 } from 'lucide-react';

// ─── Value formatting ─────────────────────────────────────────────────────────

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#14b8a6'];

function scaleRaw(raw, fmt) {
  return fmt?.scale ? raw * fmt.scale : raw;
}

function displayValue(raw, fmt) {
  const v = scaleRaw(raw, fmt);
  const dp = fmt?.decimals ?? 1;
  const rounded = typeof v === 'number' ? v.toFixed(dp) : v;
  if (fmt?.unit === '%')   return `${rounded}%`;
  if (fmt?.unit === 's')   return `${rounded}s`;
  if (fmt?.unit === 'EUR') return `€${rounded}`;
  return String(rounded);
}

function thresholdColor(rawUnscaled, thresholds, fallback = '#3b82f6') {
  if (!thresholds) return fallback;
  const { good, direction, good_color, warn_color } = thresholds;
  return direction === 'higher_is_better'
    ? rawUnscaled >= good ? good_color : warn_color
    : rawUnscaled <= good ? good_color : warn_color;
}

// Recharts tick formatter — receives the scaled value, returns display string
function tickFmt(fmt) {
  return (v) => displayValue(v / (fmt?.scale ?? 1), fmt);
}

// Recharts tooltip formatter — undoes the scale to call displayValue correctly
function tooltipFmt(fmt) {
  return (v) => [displayValue(v / (fmt?.scale ?? 1), fmt), ''];
}

// ─── Chart title block ────────────────────────────────────────────────────────

function ChartHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>{title}</div>
      {subtitle && (
        <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: 2 }}>{subtitle}</div>
      )}
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ component }) {
  const { title, subtitle, data, format: fmt } = component;
  const row = data?.[0];
  if (!row) return null;

  const raw   = row.value;
  const color = thresholdColor(raw, fmt?.thresholds, '#1e40af');
  const thr   = fmt?.thresholds;
  const isGood = !thr || (
    thr.direction === 'higher_is_better' ? raw >= thr.good : raw <= thr.good
  );

  return (
    <div style={{
      flex: '1 1 160px', minWidth: 150,
      border: `2px solid ${color}`,
      borderRadius: 12,
      padding: '0.9rem 1.1rem',
      background: `${color}12`,
      display: 'flex', flexDirection: 'column', gap: 3,
    }}>
      <span style={{
        fontSize: '0.65rem', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280',
      }}>
        {title}
      </span>
      <span style={{ fontSize: '2rem', fontWeight: 800, color, lineHeight: 1.1 }}>
        {displayValue(raw, fmt)}
      </span>
      {thr && (
        <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>
          Target {thr.direction === 'higher_is_better' ? '≥' : '≤'} {displayValue(thr.good, fmt)}
          {' · '}
          <span style={{ color: isGood ? thr.good_color : thr.warn_color, fontWeight: 600 }}>
            {isGood ? '✓ On track' : '⚠ Attention'}
          </span>
        </span>
      )}
      {subtitle && (
        <span style={{ fontSize: '0.62rem', color: '#9ca3af', marginTop: 2 }}>{subtitle}</span>
      )}
    </div>
  );
}

// ─── Pie chart ────────────────────────────────────────────────────────────────

function PieComponent({ component }) {
  const { title, subtitle, data } = component;
  const total = data.reduce((s, d) => s + d.value, 0);

  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
    const RAD = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.58;
    const x = cx + r * Math.cos(-midAngle * RAD);
    const y = cy + r * Math.sin(-midAngle * RAD);
    const pct = ((value / total) * 100).toFixed(1);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle"
            dominantBaseline="central" fontSize={12} fontWeight={700}>
        {pct}%
      </text>
    );
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      <ChartHeader title={title} subtitle={subtitle} />
      <ResponsiveContainer width="100%" height={290}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name"
               cx="50%" cy="50%" outerRadius={115}
               labelLine={false} label={renderLabel}>
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => [v.toLocaleString(), '']} />
          <Legend iconType="circle" iconSize={10}
                  wrapperStyle={{ fontSize: '0.8rem', paddingTop: 8 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Bar chart ────────────────────────────────────────────────────────────────

function BarComponent({ component }) {
  const { title, subtitle, data, format: fmt } = component;
  const thr    = fmt?.thresholds;
  const rotate = data.length > 7;

  // Scale values once for recharts; threshold comparisons use the original raw values
  const scaled = data.map(d => ({ ...d, _raw: d.value, value: scaleRaw(d.value, fmt) }));

  return (
    <div style={{ marginTop: '1rem' }}>
      <ChartHeader title={title} subtitle={subtitle} />
      <ResponsiveContainer width="100%" height={rotate ? 350 : 285}>
        <BarChart
          data={scaled}
          margin={{ top: 12, right: 20, left: 8, bottom: rotate ? 90 : 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            angle={rotate ? -42 : 0}
            textAnchor={rotate ? 'end' : 'middle'}
            interval={0}
          />
          <YAxis tickFormatter={tickFmt(fmt)} tick={{ fontSize: 11, fill: '#6b7280' }} />
          <Tooltip
            formatter={tooltipFmt(fmt)}
            contentStyle={{ borderRadius: 8, fontSize: '0.8rem' }}
          />
          {thr && (
            <ReferenceLine
              y={scaleRaw(thr.good, fmt)}
              stroke={thr.good_color}
              strokeDasharray="6 3"
              label={{
                value: `Target ${displayValue(thr.good, fmt)}`,
                position: 'insideTopRight',
                fontSize: 10,
                fill: thr.good_color,
              }}
            />
          )}
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {scaled.map((row, i) => (
              <Cell key={i} fill={thresholdColor(row._raw, thr)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Line chart ───────────────────────────────────────────────────────────────

function LineComponent({ component }) {
  const { title, subtitle, data, format: fmt } = component;
  const scaled = data.map(d => ({ ...d, value: scaleRaw(d.value, fmt) }));

  return (
    <div style={{ marginTop: '1rem' }}>
      <ChartHeader title={title} subtitle={subtitle} />
      <ResponsiveContainer width="100%" height={265}>
        <LineChart data={scaled} margin={{ top: 8, right: 20, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} />
          <YAxis tickFormatter={tickFmt(fmt)} tick={{ fontSize: 11, fill: '#6b7280' }} />
          <Tooltip
            formatter={tooltipFmt(fmt)}
            contentStyle={{ borderRadius: 8, fontSize: '0.8rem' }}
          />
          <Line type="monotone" dataKey="value"
                stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: '#3b82f6' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Area chart ───────────────────────────────────────────────────────────────

function AreaComponent({ component }) {
  const { title, subtitle, data, format: fmt } = component;
  const scaled = data.map(d => ({ ...d, value: scaleRaw(d.value, fmt) }));

  return (
    <div style={{ marginTop: '1rem' }}>
      <ChartHeader title={title} subtitle={subtitle} />
      <ResponsiveContainer width="100%" height={265}>
        <AreaChart data={scaled} margin={{ top: 8, right: 20, left: 8, bottom: 8 }}>
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} />
          <YAxis tickFormatter={tickFmt(fmt)} tick={{ fontSize: 11, fill: '#6b7280' }} />
          <Tooltip
            formatter={tooltipFmt(fmt)}
            contentStyle={{ borderRadius: 8, fontSize: '0.8rem' }}
          />
          <Area type="monotone" dataKey="value"
                stroke="#3b82f6" strokeWidth={2.5}
                fill="url(#areaGrad)" dot={{ r: 3, fill: '#3b82f6' }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────

function TableComponent({ component }) {
  const { title, subtitle, data } = component;
  if (!data?.length) return null;
  const cols = Object.keys(data[0]);

  return (
    <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
      <ChartHeader title={title} subtitle={subtitle} />
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c} style={{
                padding: '7px 10px', background: '#f3f4f6',
                textAlign: 'left', fontWeight: 600, color: '#374151',
                borderBottom: '2px solid #e5e7eb',
                textTransform: 'capitalize', whiteSpace: 'nowrap',
              }}>
                {c.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
              {cols.map(c => (
                <td key={c} style={{
                  padding: '7px 10px', color: '#374151',
                  borderBottom: '1px solid #f3f4f6',
                }}>
                  {typeof row[c] === 'number'
                    ? row[c].toLocaleString(undefined, { maximumFractionDigits: 4 })
                    : String(row[c] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

function ChartComponent({ component }) {
  switch (component.type) {
    case 'kpi':   return <KpiCard component={component} />;
    case 'pie':   return <PieComponent component={component} />;
    case 'bar':   return <BarComponent component={component} />;
    case 'line':  return <LineComponent component={component} />;
    case 'area':  return <AreaComponent component={component} />;
    case 'table': return <TableComponent component={component} />;
    default:      return null;
  }
}

// Groups consecutive KPI cards into a single flex row.
function DashboardComponents({ components }) {
  if (!components?.length) return null;

  const groups = [];
  let kpiRun = [];
  for (const c of components) {
    if (c.type === 'kpi') {
      kpiRun.push(c);
    } else {
      if (kpiRun.length) { groups.push({ kind: 'kpi-row', items: kpiRun }); kpiRun = []; }
      groups.push({ kind: 'single', item: c });
    }
  }
  if (kpiRun.length) groups.push({ kind: 'kpi-row', items: kpiRun });

  return (
    <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {groups.map((g, i) =>
        g.kind === 'kpi-row' ? (
          <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {g.items.map((c, j) => <KpiCard key={j} component={c} />)}
          </div>
        ) : (
          <ChartComponent key={i} component={g.item} />
        )
      )}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const [messages, setMessages] = useState([{
    role: 'assistant',
    text: 'Hello! Ask me anything about the banking voicebot data — distributions, trends, KPIs, or open-ended checks.',
    components: null,
  }]);
  const [input, setInput]       = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage, components: null }]);
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, session_id: sessionId }),
      });
      const data = await response.json();

      if (data.session_id) setSessionId(data.session_id);

      setMessages(prev => [...prev, {
        role: 'assistant',
        text: data.reply || 'Here is the data you requested.',
        components: data.components?.length ? data.components : null,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: "Couldn't reach the backend — is FastAPI running on port 8000?",
        components: null,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      backgroundColor: '#f3f4f6', fontFamily: 'system-ui, sans-serif',
    }}>

      {/* Header */}
      <header style={{
        backgroundColor: '#1e40af', color: 'white',
        padding: '1rem', textAlign: 'center',
        fontSize: '1.25rem', fontWeight: 'bold',
        letterSpacing: '-0.01em',
      }}>
        Speak With Your Data
      </header>

      {/* Chat area */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '1.5rem',
        maxWidth: 900, margin: '0 auto', width: '100%',
      }}>
        {messages.map((msg, index) => (
          <div key={index} style={{
            display: 'flex', gap: '0.75rem', marginBottom: '1.5rem',
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
          }}>

            {/* Avatar */}
            <div style={{
              flexShrink: 0, width: 38, height: 38, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: msg.role === 'user' ? '#3b82f6' : '#10b981',
              color: 'white', marginTop: 2,
            }}>
              {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
            </div>

            {/* Bubble — wider for assistant messages that carry charts */}
            <div style={{
              maxWidth: msg.components ? '100%' : '78%',
              flex: msg.components ? 1 : undefined,
              padding: '0.9rem 1.1rem',
              borderRadius: 12,
              backgroundColor: msg.role === 'user' ? '#bfdbfe' : '#ffffff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}>
              <p style={{ margin: 0, lineHeight: 1.6, fontSize: '0.92rem', color: '#111827' }}>
                {msg.text}
              </p>
              <DashboardComponents components={msg.components} />
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6b7280', fontSize: '0.88rem' }}>
            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
            Analysing your data…
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ backgroundColor: 'white', padding: '1rem', borderTop: '1px solid #e5e7eb' }}>
        <form onSubmit={handleSend} style={{
          maxWidth: 900, margin: '0 auto', display: 'flex', gap: '0.5rem',
        }}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="e.g. Show containment rate by intent this week, or: How is the bot doing?"
            style={{
              flex: 1, padding: '0.75rem 1rem', borderRadius: 8,
              border: '1px solid #d1d5db', outline: 'none', fontSize: '0.95rem',
            }}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            style={{
              backgroundColor: isLoading || !input.trim() ? '#93c5fd' : '#1e40af',
              color: 'white', padding: '0.75rem 1.4rem', borderRadius: 8,
              border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              fontWeight: 700, fontSize: '0.9rem', transition: 'background 0.15s',
            }}
          >
            Send <Send size={16} />
          </button>
        </form>
      </div>

    </div>
  );
}

export default App;
