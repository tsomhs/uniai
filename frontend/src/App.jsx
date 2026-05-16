import React, { useState, useRef, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
  AreaChart, Area, ReferenceLine,
} from 'recharts';
import { Send, User, Bot, Loader2, X, BarChart2, Paperclip, Check, Sparkles } from 'lucide-react';

// ─── Theme ────────────────────────────────────────────────────────────────────

const T = {
  bg:        '#09090b',
  surface:   '#18181b',
  border:    '#27272a',
  border2:   '#3f3f46',
  textPri:   '#e4e4e7',
  textMuted: '#a1a1aa',
  textDim:   '#71717a',
  purple:    '#9333ea',
  purpleHi:  '#a855f7',
  purpleSoft:'#d8b4fe',
  userBg:    '#7e22ce',
  userText:  '#fdf4ff',
};

const PIE_COLORS  = ['#a855f7', '#c084fc', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'];
const TOOLTIP_STYLE = {
  backgroundColor: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  color: T.textPri,
  fontSize: '0.8rem',
  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
};
const AXIS_TICK = { fill: T.textDim, fontSize: 11 };

// ─── Formatting helpers ───────────────────────────────────────────────────────

// Single source of truth for rendering a backend value. Raw values are always
// in their natural unit (0-1 for rates); fmt.scale converts to display units.
function displayValue(raw, fmt) {
  if (raw == null || raw === '') return '—';
  const v = fmt?.scale ? raw * fmt.scale : raw;
  const dp = fmt?.decimals ?? 1;
  const rounded = typeof v === 'number' ? v.toFixed(dp) : v;
  if (fmt?.unit === '%')   return `${rounded}%`;
  if (fmt?.unit === 's')   return `${rounded}s`;
  if (fmt?.unit === 'EUR') return `€${rounded}`;
  return String(rounded);
}

function thresholdColor(raw, thresholds, fallback = T.purpleHi) {
  if (!thresholds) return fallback;
  const { good, direction, good_color, warn_color } = thresholds;
  return direction === 'higher_is_better'
    ? raw >= good ? good_color : warn_color
    : raw <= good ? good_color : warn_color;
}

// snake_case → Title Case  |  ISO date → "Apr 18"
function formatXLabel(s) {
  const str = String(s ?? '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return new Date(str + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' });
  }
  return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Shared chart sub-components ─────────────────────────────────────────────

function ChartHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: '0.6rem' }}>
      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: T.textPri }}>{title}</div>
      {subtitle && (
        <div style={{ fontSize: '0.68rem', color: T.textDim, marginTop: 2 }}>{subtitle}</div>
      )}
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ component }) {
  const { title, subtitle, data, format: fmt } = component;
  const row = data?.[0];
  if (!row) return null;

  const raw    = row.value;
  const thr    = fmt?.thresholds;
  const color  = thresholdColor(raw, thr, T.purpleHi);
  const isGood = !thr || (thr.direction === 'higher_is_better' ? raw >= thr.good : raw <= thr.good);

  return (
    <div style={{
      flex: '1 1 150px', minWidth: 140,
      border: `2px solid ${color}`,
      borderRadius: 12,
      padding: '0.9rem 1.1rem',
      background: `${color}18`,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.textMuted }}>
        {title}
      </span>
      <span style={{ fontSize: '2rem', fontWeight: 800, color, lineHeight: 1.1 }}>
        {displayValue(raw, fmt)}
      </span>
      {thr && (
        <span style={{ fontSize: '0.62rem', color: T.textDim }}>
          Target {thr.direction === 'higher_is_better' ? '≥' : '≤'} {displayValue(thr.good, fmt)}
          {' · '}
          <span style={{ color: isGood ? thr.good_color : thr.warn_color, fontWeight: 600 }}>
            {isGood ? '✓ On track' : '⚠ Attention'}
          </span>
        </span>
      )}
      {subtitle && <span style={{ fontSize: '0.6rem', color: T.textDim, marginTop: 1 }}>{subtitle}</span>}
    </div>
  );
}

// ─── Pie ──────────────────────────────────────────────────────────────────────

function PieComponent({ component }) {
  const { title, subtitle, data } = component;
  const total = data.reduce((s, d) => s + d.value, 0);

  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
    const RAD = Math.PI / 180;
    const r   = innerRadius + (outerRadius - innerRadius) * 0.58;
    const x   = cx + r * Math.cos(-midAngle * RAD);
    const y   = cy + r * Math.sin(-midAngle * RAD);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle"
            dominantBaseline="central" fontSize={12} fontWeight={700}>
        {((value / total) * 100).toFixed(1)}%
      </text>
    );
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      <ChartHeader title={title} subtitle={subtitle} />
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name"
               cx="50%" cy="50%" outerRadius={110}
               labelLine={false} label={renderLabel}
               stroke={T.bg} strokeWidth={3}>
            {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: T.purpleSoft }}
                   formatter={v => [v.toLocaleString(), '']} />
          <Legend iconType="circle" iconSize={10}
                  wrapperStyle={{ fontSize: '0.78rem', color: T.textMuted, paddingTop: 8 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Bar ──────────────────────────────────────────────────────────────────────

function BarComponent({ component }) {
  const { title, subtitle, data, format: fmt } = component;
  const thr    = fmt?.thresholds;
  const rotate = data.length > 7;
  const domain = fmt?.unit === '%' ? [0, 1] : ['auto', 'auto'];

  return (
    <div style={{ marginTop: '1rem' }}>
      <ChartHeader title={title} subtitle={subtitle} />
      <ResponsiveContainer width="100%" height={rotate ? 350 : 285}>
        <BarChart data={data} margin={{ top: 12, right: 20, left: 8, bottom: rotate ? 90 : 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
          <XAxis dataKey="name" tickFormatter={formatXLabel} tick={AXIS_TICK}
                 angle={rotate ? -42 : 0} textAnchor={rotate ? 'end' : 'middle'}
                 interval={0} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={v => displayValue(v, fmt)} domain={domain}
                 tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <Tooltip labelFormatter={formatXLabel} formatter={v => [displayValue(v, fmt), '']}
                   contentStyle={TOOLTIP_STYLE} cursor={{ fill: `${T.border}80` }} />
          {thr && (
            <ReferenceLine y={thr.good} stroke={thr.good_color} strokeDasharray="6 3"
              label={{ value: `Target ${displayValue(thr.good, fmt)}`, position: 'insideTopRight',
                       fontSize: 10, fill: thr.good_color }} />
          )}
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {data.map((row, i) => (
              <Cell key={i} fill={thresholdColor(row.value, thr)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Line ─────────────────────────────────────────────────────────────────────

function LineComponent({ component }) {
  const { title, subtitle, data, format: fmt } = component;

  return (
    <div style={{ marginTop: '1rem' }}>
      <ChartHeader title={title} subtitle={subtitle} />
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 20, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
          <XAxis dataKey="name" tickFormatter={formatXLabel} tick={AXIS_TICK}
                 axisLine={false} tickLine={false} />
          <YAxis tickFormatter={v => displayValue(v, fmt)} tick={AXIS_TICK}
                 axisLine={false} tickLine={false} />
          <Tooltip labelFormatter={formatXLabel} formatter={v => [displayValue(v, fmt), '']}
                   contentStyle={TOOLTIP_STYLE} />
          <Line type="monotone" dataKey="value" stroke={T.purpleHi} strokeWidth={3}
                dot={{ r: 3, fill: T.purpleHi }} activeDot={{ r: 5, fill: T.purpleSoft }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Area ─────────────────────────────────────────────────────────────────────

function AreaComponent({ component }) {
  const { title, subtitle, data, format: fmt } = component;

  return (
    <div style={{ marginTop: '1rem' }}>
      <ChartHeader title={title} subtitle={subtitle} />
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 8, right: 20, left: 8, bottom: 8 }}>
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={T.purpleHi} stopOpacity={0.35} />
              <stop offset="95%" stopColor={T.purpleHi} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
          <XAxis dataKey="name" tickFormatter={formatXLabel} tick={AXIS_TICK}
                 axisLine={false} tickLine={false} />
          <YAxis tickFormatter={v => displayValue(v, fmt)} tick={AXIS_TICK}
                 axisLine={false} tickLine={false} />
          <Tooltip labelFormatter={formatXLabel} formatter={v => [displayValue(v, fmt), '']}
                   contentStyle={TOOLTIP_STYLE} />
          <Area type="monotone" dataKey="value" stroke={T.purpleHi} strokeWidth={3}
                fill="url(#areaGrad)" dot={{ r: 3, fill: T.purpleHi }}
                activeDot={{ r: 5, fill: T.purpleSoft }} />
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
      <div style={{ borderRadius: 8, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ backgroundColor: T.border }}>
              {cols.map(c => (
                <th key={c} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600,
                                     color: T.textMuted, whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                  {c.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? T.surface : T.bg,
                                   borderBottom: `1px solid ${T.border}` }}>
                {cols.map(c => (
                  <td key={c} style={{ padding: '8px 12px', color: T.textPri }}>
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
    </div>
  );
}

// ─── Dispatcher + grouper ─────────────────────────────────────────────────────

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

// Groups consecutive KPI cards into a flex row so they sit side-by-side.
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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

// Test Mode mock — demonstrates the full dashboard contract without an API call.
const TEST_COMPONENTS = [
  {
    type: 'kpi', title: 'Containment Rate', subtitle: 'This week',
    data: [{ name: 'Containment Rate', value: 0.762 }],
    format: { unit: '%', scale: 100, decimals: 1,
              thresholds: { good: 0.85, direction: 'higher_is_better',
                            good_color: '#7C3AED', warn_color: '#F59E0B' } },
  },
  {
    type: 'bar', title: 'Calls by Region', subtitle: 'All conversations',
    data: [
      { name: 'attica', value: 5007 }, { name: 'thessaloniki', value: 2156 },
      { name: 'crete',  value: 1204 }, { name: 'patras',       value: 876  },
      { name: 'larissa',value: 543  }, { name: 'other_gr',     value: 214  },
    ],
    format: { unit: '', scale: 1, decimals: 0, thresholds: null },
  },
];

function panelLabel(components) {
  if (!components?.length) return '';
  if (components.length === 1) {
    const t = components[0].type;
    return `View ${t.charAt(0).toUpperCase() + t.slice(1)} Chart`;
  }
  return `View Dashboard (${components.length} charts)`;
}

export default function App() {
  const [messages, setMessages] = useState([{
    role: 'assistant',
    text: 'Hello! I am connected to your database. What would you like to know?',
    components: null,
  }]);
  const [input,            setInput]            = useState('');
  const [isLoading,        setIsLoading]        = useState(false);
  const [activeComponents, setActiveComponents] = useState(null);
  const [sessionId,        setSessionId]        = useState(null);
  const [completedSteps,   setCompletedSteps]   = useState([]);
  const [currentStep,      setCurrentStep]      = useState('');
  const currentStepRef = useRef('');
  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Test Mode ──
  const runTestMode = () => {
    const reply = 'Here is a mock dashboard. I have opened the Data Inspector on the right.';
    setMessages(prev => [
      ...prev,
      { role: 'user', text: '(Test Mode) Show me a quick overview.', components: null },
      { role: 'assistant', text: reply, components: TEST_COMPONENTS },
    ]);
    setActiveComponents(TEST_COMPONENTS);
  };

  // ── API call — SSE streaming ──
  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage, components: null }]);
    setIsLoading(true);
    setCompletedSteps([]);
    setCurrentStep('');
    currentStepRef.current = '';

    try {
      const response = await fetch('http://localhost:8000/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, session_id: sessionId }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Server error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;

          let event;
          try { event = JSON.parse(raw); } catch { continue; }

          if (event.type === 'progress') {
            // Move the previous step into the completed list before showing the new one
            if (currentStepRef.current) {
              const done = currentStepRef.current;
              setCompletedSteps(s => [...s, done]);
            }
            currentStepRef.current = event.message;
            setCurrentStep(event.message);

          } else if (event.type === 'result') {
            if (event.session_id) setSessionId(event.session_id);
            const components = event.components?.length ? event.components : null;
            setMessages(prev => [...prev, {
              role: 'assistant',
              text: event.reply || 'Here is the data you requested.',
              components,
              suggestions: event.suggestions || [],
            }]);
            if (components) setActiveComponents(components);

          } else if (event.type === 'error') {
            setMessages(prev => [...prev, {
              role: 'assistant',
              text: `Something went wrong: ${event.message}`,
              components: null,
            }]);
          }
        }
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: "Couldn't reach the backend — is FastAPI running on port 8000?",
        components: null,
      }]);
    } finally {
      setIsLoading(false);
      setCompletedSteps([]);
      setCurrentStep('');
      currentStepRef.current = '';
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: T.bg,
                  color: T.textPri, fontFamily: 'system-ui, -apple-system, sans-serif',
                  overflow: 'hidden' }}>

      {/* ── LEFT: Chat ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Header */}
        <header style={{ backgroundColor: T.bg, padding: '1.5rem',
                         borderBottom: `1px solid ${T.border}`,
                         display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: T.purpleSoft,
                       display: 'flex', alignItems: 'center' }}>
            Speak With Your Data
            <span style={{ fontSize: '0.65rem', color: '#bd69df', fontWeight: 400,
                           marginLeft: '0.35rem', marginTop: '0.6rem', letterSpacing: '0.05em' }}>
              {' '}by Prompt Masters
            </span>
          </h1>
          <button onClick={runTestMode} style={{
            backgroundColor: T.surface, color: T.purpleSoft, padding: '0.5rem 1rem',
            borderRadius: 8, border: `1px solid ${T.border2}`, cursor: 'pointer',
            fontSize: '0.9rem', fontWeight: 500, transition: 'all 0.2s',
          }}
            onMouseOver={e => { e.currentTarget.style.borderColor = T.purple; e.currentTarget.style.backgroundColor = T.border; }}
            onMouseOut={e =>  { e.currentTarget.style.borderColor = T.border2; e.currentTarget.style.backgroundColor = T.surface; }}
          >
            Test Mode
          </button>
        </header>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
          <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '1rem',
                                      flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>

                {/* Avatar */}
                <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 12,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              backgroundColor: msg.role === 'user' ? T.purple : T.border,
                              color: msg.role === 'user' ? 'white' : T.textMuted }}>
                  {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                </div>

                {/* Bubble */}
                <div style={{
                  maxWidth: '85%', padding: '1.25rem', borderRadius: 16,
                  backgroundColor: msg.role === 'user' ? T.userBg : T.surface,
                  border: msg.role === 'user' ? 'none' : `1px solid ${T.border}`,
                  borderTopRightRadius: msg.role === 'user' ? 4 : 16,
                  borderTopLeftRadius:  msg.role === 'assistant' ? 4 : 16,
                }}>
                  <p style={{ margin: 0, lineHeight: 1.6, fontSize: '1rem',
                              color: msg.role === 'user' ? T.userText : T.textPri }}>
                    {msg.text}
                  </p>

                  {/* "View Dashboard" button — opens the side panel */}
                  {msg.components && (
                    <button
                      onClick={() => setActiveComponents(
                        activeComponents === msg.components ? null : msg.components
                      )}
                      style={{
                        marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.6rem 1rem', borderRadius: 8, cursor: 'pointer',
                        fontSize: '0.88rem', transition: 'all 0.2s',
                        backgroundColor: activeComponents === msg.components ? T.purple : T.border,
                        border: `1px solid ${activeComponents === msg.components ? T.purple : T.border2}`,
                        color: activeComponents === msg.components ? 'white' : T.purpleSoft,
                      }}
                      onMouseOver={e => { if (activeComponents !== msg.components) e.currentTarget.style.borderColor = T.purple; }}
                      onMouseOut={e =>  { if (activeComponents !== msg.components) e.currentTarget.style.borderColor = T.border2; }}
                    >
                      <BarChart2 size={16} />
                      {panelLabel(msg.components)}
                    </button>
                  )}

                  {/* Suggested follow-up questions */}
                  {msg.role === 'assistant' && msg.suggestions?.length > 0 && (
                    <div style={{ marginTop: '1.1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5,
                                    marginBottom: '0.5rem' }}>
                        <Sparkles size={11} color={T.textDim} />
                        <span style={{ fontSize: '0.68rem', fontWeight: 600, color: T.textDim,
                                       textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                          Explore further
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {msg.suggestions.map((q, i) => (
                          <button key={i} onClick={() => {
                            setInput(q);
                            inputRef.current?.focus();
                          }} style={{
                            textAlign: 'left', background: 'none', cursor: 'pointer',
                            padding: '0.45rem 0.75rem', borderRadius: 8,
                            border: `1px solid ${T.border2}`,
                            color: T.textMuted, fontSize: '0.82rem',
                            lineHeight: 1.4, transition: 'all 0.18s',
                          }}
                            onMouseOver={e => {
                              e.currentTarget.style.borderColor = T.purple;
                              e.currentTarget.style.color = T.purpleSoft;
                              e.currentTarget.style.background = `${T.purple}14`;
                            }}
                            onMouseOut={e => {
                              e.currentTarget.style.borderColor = T.border2;
                              e.currentTarget.style.color = T.textMuted;
                              e.currentTarget.style.background = 'none';
                            }}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div style={{ display: 'flex', gap: '1rem', paddingLeft: '4rem' }}>
                {/* Bot avatar placeholder */}
                <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 12,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              backgroundColor: T.border, color: T.textMuted }}>
                  <Bot size={20} />
                </div>

                {/* Step list */}
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 10,
                  borderLeft: `2px solid ${T.border2}`, paddingLeft: '1rem',
                }}>
                  {completedSteps.map((step, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7,
                                          color: T.textDim, fontSize: '0.78rem' }}>
                      <Check size={12} color={T.purple} strokeWidth={3} />
                      <span>{step}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7,
                                color: T.textMuted, fontSize: '0.82rem', fontWeight: 500 }}>
                    <Loader2 size={13} className="animate-spin" />
                    <span>{currentStep || 'Connecting…'}</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div style={{ backgroundColor: T.bg, padding: '1.5rem', borderTop: `1px solid ${T.border}` }}>
          <form onSubmit={handleSend}
                style={{ maxWidth: 800, margin: '0 auto', display: 'flex', gap: '0.75rem' }}>
            <button type="button" title="Upload files" style={{
              backgroundColor: T.surface, color: T.textMuted,
              padding: '0 1.25rem', borderRadius: 12,
              border: `1px solid ${T.border}`, cursor: 'pointer',
              display: 'flex', alignItems: 'center', transition: 'all 0.2s',
            }}
              onMouseOver={e => { e.currentTarget.style.color = T.purpleSoft; e.currentTarget.style.borderColor = T.purple; }}
              onMouseOut={e =>  { e.currentTarget.style.color = T.textMuted;  e.currentTarget.style.borderColor = T.border; }}
            >
              <Paperclip size={20} />
            </button>

            <input
              ref={inputRef}
              type="text" value={input} onChange={e => setInput(e.target.value)}
              placeholder="Ask a question about your data…"
              disabled={isLoading}
              style={{ flex: 1, padding: '1rem 1.25rem', borderRadius: 12,
                       border: `1px solid ${T.border}`, backgroundColor: T.surface,
                       color: '#f4f4f5', outline: 'none', fontSize: '1rem',
                       transition: 'border-color 0.2s' }}
              onFocus={e => e.target.style.borderColor = T.purple}
              onBlur={e =>  e.target.style.borderColor = T.border}
            />

            <button type="submit" disabled={isLoading || !input.trim()} style={{
              backgroundColor: T.purple, color: 'white',
              padding: '0 1.5rem', borderRadius: 12, border: 'none',
              cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background-color 0.2s',
              opacity: isLoading || !input.trim() ? 0.5 : 1,
            }}>
              <Send size={20} />
            </button>
          </form>
        </div>
      </div>

      {/* ── RIGHT: Data Inspector Panel ── */}
      {activeComponents && (
        <div style={{
          width: 480, borderLeft: `1px solid ${T.border}`,
          backgroundColor: T.bg, display: 'flex', flexDirection: 'column',
          animation: 'slideIn 0.25s ease-out',
        }}>
          {/* Panel header */}
          <div style={{ padding: '1.5rem', borderBottom: `1px solid ${T.border}`,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 500, color: T.textPri,
                         display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart2 size={20} color={T.purpleHi} /> Data Inspector
            </h2>
            <button onClick={() => setActiveComponents(null)} style={{
              background: 'none', border: 'none', color: T.textMuted,
              cursor: 'pointer', transition: 'color 0.2s', lineHeight: 0,
            }}
              onMouseOver={e => e.currentTarget.style.color = T.textPri}
              onMouseOut={e =>  e.currentTarget.style.color = T.textMuted}
            >
              <X size={22} />
            </button>
          </div>

          {/* Panel body — scrollable dashboard */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
            <DashboardComponents components={activeComponents} />
          </div>
        </div>
      )}
    </div>
  );
}
