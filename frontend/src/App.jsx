import React, { useState, useRef, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
  AreaChart, Area, ReferenceLine,
} from 'recharts';
import { Send, User, Bot, Loader2, X, BarChart2, Paperclip, GripVertical, Menu, Plus, MessageSquare } from 'lucide-react';

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
  const [sessionId,        setSessionId]        = useState(null);
  
  // Tracking active message index for right panel
  const [activeIndex,      setActiveIndex]      = useState(null);
  const activeComponents = activeIndex !== null ? messages[activeIndex]?.components : null;
  
  // Sidebar State & Chat History
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [chatHistory, setChatHistory] = useState([
    { id: 1, title: 'Analysis: Region Volume' },
    { id: 2, title: 'Trend: CSAT Scores' },
    { id: 3, title: 'Containment Rates 2026' },
  ]);
  const [activeChatId, setActiveChatId] = useState(1);
  
  // Staging area for files
  const [selectedFiles,    setSelectedFiles]    = useState([]);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // Panel resizing states
  const [panelWidth, setPanelWidth] = useState(480);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const newWidth = document.body.clientWidth - e.clientX;
      if (newWidth > 300 && newWidth < 900) {
        setPanelWidth(newWidth);
      }
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      // Prevent text selection while dragging
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    } else {
      document.body.style.userSelect = '';
      document.body.style.cursor = 'default';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const runTestMode = () => {
    const reply = 'Here is a mock dashboard. I have opened the Data Inspector on the right.';
    setMessages(prev => {
      const next = [
        ...prev,
        { role: 'user', text: '(Test Mode) Show me a quick overview.', components: null },
        { role: 'assistant', text: reply, components: TEST_COMPONENTS },
      ];
      setActiveIndex(next.length - 1);
      return next;
    });
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() && selectedFiles.length === 0) return;

    const userMessage = input;
    const filesToSend = [...selectedFiles];
    
    setInput('');
    setSelectedFiles([]);
    
    setMessages(prev => [...prev, { role: 'user', text: userMessage, components: null, files: filesToSend }]);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('message', userMessage);
      if (sessionId) formData.append('session_id', sessionId);
      filesToSend.forEach(file => {
        formData.append('files', file); 
      });

      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();

      if (data.session_id) setSessionId(data.session_id);

      const components = data.components?.length ? data.components : null;
      setMessages(prev => {
        const next = [...prev, {
          role: 'assistant',
          text: data.reply || 'Here is the data you requested.',
          components,
        }];
        if (components) setActiveIndex(next.length - 1);
        return next;
      });

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        // User friendly error message
        text: "Oops! We couldn't connect to the server right now. Please make sure the backend is running and try again.",
        components: null,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: T.bg,
                  color: T.textPri, fontFamily: 'system-ui, -apple-system, sans-serif',
                  overflow: 'hidden' }}>

      {/* ── LEFT SIDEBAR (Collapsible) ── */}
      <div style={{
        width: isSidebarOpen ? 260 : 0,
        flexShrink: 0,
        backgroundColor: '#000000', // Slightly darker than T.bg to differentiate
        borderRight: isSidebarOpen ? `1px solid ${T.border}` : 'none',
        transition: 'width 0.3s ease',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 260, flex: 1 }}>
          
          <button style={{
             display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: T.surface,
             color: T.textPri, padding: '0.75rem 1rem', borderRadius: 8, border: `1px solid ${T.border2}`,
             cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, transition: 'all 0.2s', justifyContent: 'center'
          }}
            onMouseOver={e => e.currentTarget.style.borderColor = T.purpleSoft}
            onMouseOut={e => e.currentTarget.style.borderColor = T.border2}
          >
            <Plus size={18} /> New Chat
          </button>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
             <h3 style={{ fontSize: '0.75rem', color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', paddingLeft: '0.5rem' }}>Chat History</h3>
             {chatHistory.map(chat => (
                <button key={chat.id} 
                  onClick={() => setActiveChatId(chat.id)}
                  style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem',
                  backgroundColor: activeChatId === chat.id ? T.surface : 'transparent',
                  border: 'none', borderRadius: 8, color: activeChatId === chat.id ? T.textPri : T.textMuted,
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s'
                }}>
                  <MessageSquare size={16} />
                  <span style={{ fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chat.title}</span>
                </button>
             ))}
          </div>
        </div>
      </div>

      {/* ── MAIN MIDDLE: Chat ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Header */}
        <header style={{ backgroundColor: T.bg, padding: '1.5rem',
                         borderBottom: `1px solid ${T.border}`,
                         display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              onMouseOver={e => e.currentTarget.style.color = T.textPri}
              onMouseOut={e => e.currentTarget.style.color = T.textMuted}
            >
              <Menu size={24} />
            </button>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: T.purpleSoft,
                         display: 'flex', alignItems: 'center' }}>
              Speak With Your Data
              <span style={{ fontSize: '0.65rem', color: '#bd69df', fontWeight: 400,
                             marginLeft: '0.35rem', marginTop: '0.6rem', letterSpacing: '0.05em' }}>
                {' '}by Prompt Masters
              </span>
            </h1>
          </div>

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
                  {msg.text && (
                    <p style={{ margin: 0, lineHeight: 1.6, fontSize: '1rem',
                                color: msg.role === 'user' ? T.userText : T.textPri }}>
                      {msg.text}
                    </p>
                  )}

                  {/* Render attached files for user messages */}
                  {msg.files && msg.files.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: msg.text ? '0.75rem' : '0' }}>
                      {msg.files.map((file, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'rgba(255,255,255,0.15)', padding: '0.35rem 0.6rem', borderRadius: 8, fontSize: '0.85rem', color: T.userText }}>
                          <Paperclip size={14} />
                          <span>{file.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* "View Dashboard" button — hides ONLY if this specific message index is active */}
                  {msg.components && activeIndex !== idx && (
                    <button
                      onClick={() => setActiveIndex(idx)}
                      style={{
                        marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.6rem 1rem', borderRadius: 8, cursor: 'pointer',
                        fontSize: '0.88rem', transition: 'all 0.2s',
                        backgroundColor: T.border,
                        border: `1px solid ${T.border2}`,
                        color: T.purpleSoft,
                      }}
                      onMouseOver={e => e.currentTarget.style.borderColor = T.purple}
                      onMouseOut={e => e.currentTarget.style.borderColor = T.border2}
                    >
                      <BarChart2 size={16} />
                      {panelLabel(msg.components)}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem',
                            color: T.textMuted, paddingLeft: '4rem' }}>
                <Loader2 className="animate-spin" size={20} /> Analyzing data…
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input area */}
        <div style={{ backgroundColor: T.bg, padding: '1.5rem', borderTop: `1px solid ${T.border}` }}>
          <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            
            {/* File Staging Preview before sending */}
            {selectedFiles.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {selectedFiles.map((file, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: T.surface, border: `1px solid ${T.border2}`, padding: '0.35rem 0.75rem', borderRadius: 8, fontSize: '0.85rem', color: T.textPri }}>
                    <Paperclip size={14} color={T.textMuted} />
                    <span>{file.name}</span>
                    <button type="button" onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0, marginLeft: '0.25rem' }}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.75rem' }}>
              <input
                type="file"
                multiple
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".csv,.json,.jsonl,.xlsx,.xls"
                onChange={(e) => {
                  const files = Array.from(e.target.files);
                  if (files.length > 0) {
                    setSelectedFiles(prev => [...prev, ...files]);
                  }
                  e.target.value = '';
                }}
              />
              
              <button 
                type="button" 
                title="Upload files" 
                onClick={() => fileInputRef.current?.click()}
                style={{
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

              <button type="submit" disabled={isLoading || (!input.trim() && selectedFiles.length === 0)} style={{
                backgroundColor: T.purple, color: 'white',
                padding: '0 1.5rem', borderRadius: 12, border: 'none',
                cursor: isLoading || (!input.trim() && selectedFiles.length === 0) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background-color 0.2s',
                opacity: isLoading || (!input.trim() && selectedFiles.length === 0) ? 0.5 : 1,
              }}>
                <Send size={20} />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Data Inspector Panel (Resizable & Scrollable single block) ── */}
      {activeComponents && (
        <div style={{
          width: panelWidth,
          borderLeft: `1px solid ${T.border}`,
          backgroundColor: T.bg, display: 'flex', flexDirection: 'column',
          position: 'relative',
          animation: 'slideIn 0.25s ease-out',
        }}>
          
          {/* DRAG HANDLE */}
          <div
            onMouseDown={() => setIsDragging(true)}
            style={{
              position: 'absolute', left: -8, top: 0, bottom: 0, width: 16,
              cursor: 'col-resize', display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'transparent', zIndex: 10,
            }}
          >
            {/* Visual highlight line */}
            <div style={{ position: 'absolute', left: 7, top: 0, bottom: 0, width: 2, backgroundColor: isDragging ? T.purple : 'transparent', transition: 'background-color 0.2s' }} />
            
            {/* Grip Icon */}
            <div style={{ 
              backgroundColor: T.surface, border: `1px solid ${T.border}`, borderRadius: 4, padding: 2, zIndex: 11, 
              color: isDragging ? T.purpleSoft : T.textDim, opacity: isDragging ? 1 : 0.8, transition: 'all 0.2s' 
            }}>
              <GripVertical size={14} />
            </div>
          </div>

          <div style={{ padding: '1.5rem', borderBottom: `1px solid ${T.border}`,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 500, color: T.textPri,
                         display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart2 size={20} color={T.purpleHi} /> Data Inspector
            </h2>
            <button onClick={() => setActiveIndex(null)} style={{
              background: 'none', border: 'none', color: T.textMuted,
              cursor: 'pointer', transition: 'color 0.2s', lineHeight: 0,
            }}
              onMouseOver={e => e.currentTarget.style.color = T.textPri}
              onMouseOut={e =>  e.currentTarget.style.color = T.textMuted}
            >
              <X size={22} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
            <DashboardComponents components={activeComponents} />
            
            {/* Auto-generated Data Table below charts to show raw data array */}
            {activeComponents.some(c => c.type !== 'table' && c.type !== 'kpi' && c.data) && (
              <div style={{ marginTop: '3rem', borderTop: `1px solid ${T.border}`, paddingTop: '1.5rem' }}>
                <h3 style={{ fontSize: '0.85rem', color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Raw Data Overview</h3>
                {activeComponents.filter(c => c.type !== 'table' && c.type !== 'kpi' && c.data).map((chartObj, idx) => (
                  <TableComponent key={idx} component={{ title: chartObj.title || 'Extracted Data', data: chartObj.data }} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}