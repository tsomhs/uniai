import React, { useState, useRef, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
  AreaChart, Area, ReferenceLine,
} from 'recharts';
import {
  Send, User, Bot, Loader2, X, BarChart2, Paperclip, Check, Sparkles,
  Database, Upload, Plus, Trash2, ChevronDown, Link,
  GripVertical, Menu, MessageSquare,
} from 'lucide-react';

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

// ─── Datasource UI ───────────────────────────────────────────────────────────

const DS_TYPE_COLOR = {
  duckdb:   '#7C3AED',
  csv:      '#10b981',
  json:     '#10b981',
  jsonl:    '#10b981',
  postgres: '#3b82f6',
  sqlite:   '#f59e0b',
};

function DsTypeBadge({ type }) {
  const label = { duckdb: 'DuckDB', csv: 'CSV', json: 'JSON', jsonl: 'JSONL',
                  postgres: 'PostgreSQL', sqlite: 'SQLite' }[type] ?? type;
  return (
    <span style={{
      fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px',
      borderRadius: 6, background: `${DS_TYPE_COLOR[type] ?? '#71717a'}28`,
      color: DS_TYPE_COLOR[type] ?? '#71717a',
      textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      {label}
    </span>
  );
}

function DataSourceModal({ datasources, activeDsId, onSwitch, onDelete, onClose, onRefresh }) {
  const [tab,       setTab]       = useState('list');
  const [busy,      setBusy]      = useState(false);
  const [error,     setError]     = useState('');
  const [pgForm,    setPgForm]    = useState({ host: '', port: '5432', database: '', user: '', password: '', tables: '', display_name: '' });
  const fileInputRef   = useRef(null);
  const sqliteInputRef = useRef(null);

  const resetError = () => setError('');

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'json', 'jsonl'].includes(ext)) {
      setError('Only .csv, .json, and .jsonl files are supported.'); return;
    }
    setBusy(true); setError('');
    const form = new FormData();
    form.append('file', file);
    form.append('display_name', file.name.replace(/\.[^.]+$/, ''));
    try {
      const res = await fetch('http://localhost:8000/api/datasource/upload', { method: 'POST', body: form });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Upload failed'); }
      await onRefresh();
      setTab('list');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); e.target.value = ''; }
  };

  const handlePgConnect = async () => {
    const tables = pgForm.tables.split(',').map(t => t.trim()).filter(Boolean);
    if (!pgForm.host || !pgForm.database || !pgForm.user || !tables.length) {
      setError('Fill in host, database, user, and at least one table name.'); return;
    }
    setBusy(true); setError('');
    try {
      const res = await fetch('http://localhost:8000/api/datasource/connect/postgres', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...pgForm, port: parseInt(pgForm.port, 10), tables }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Connection failed'); }
      await onRefresh();
      setTab('list');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const handleSqliteUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setError('');
    const form = new FormData();
    form.append('file', file);
    form.append('display_name', file.name.replace(/\.[^.]+$/, ''));
    try {
      const res = await fetch('http://localhost:8000/api/datasource/connect/sqlite', { method: 'POST', body: form });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Import failed'); }
      await onRefresh();
      setTab('list');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); e.target.value = ''; }
  };

  const inputStyle = {
    width: '100%', padding: '0.55rem 0.8rem', borderRadius: 8, fontSize: '0.85rem',
    background: T.bg, border: `1px solid ${T.border2}`, color: T.textPri,
    outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = { fontSize: '0.72rem', color: T.textMuted, fontWeight: 600,
                       textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 };
  const primaryBtn = (disabled) => ({
    padding: '0.55rem 1.1rem', borderRadius: 8, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    background: disabled ? T.border2 : T.purple, color: 'white', fontSize: '0.85rem',
    fontWeight: 600, opacity: disabled ? 0.6 : 1, transition: 'all 0.2s',
  });

  const tabs = [
    { key: 'list',     label: 'My Sources', Icon: Database },
    { key: 'upload',   label: 'Upload File', Icon: Upload   },
    { key: 'postgres', label: 'PostgreSQL',  Icon: Link     },
    { key: 'sqlite',   label: 'SQLite',      Icon: Database },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: 560, maxHeight: '85vh', borderRadius: 16, overflow: 'hidden',
        background: T.surface, border: `1px solid ${T.border}`,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        {/* Modal header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: `1px solid ${T.border}`,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '1rem', color: T.textPri,
                         display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={18} color={T.purpleHi} /> Data Sources
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
                                             color: T.textMuted, cursor: 'pointer', lineHeight: 0 }}>
            <X size={20} />
          </button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`,
                      background: T.bg, padding: '0 0.5rem' }}>
          {tabs.map(({ key, label, Icon }) => (
            <button key={key} onClick={() => { setTab(key); resetError(); }} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0.7rem 0.9rem', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: '0.8rem', fontWeight: 600,
              color: tab === key ? T.purpleHi : T.textDim,
              borderBottom: tab === key ? `2px solid ${T.purpleHi}` : '2px solid transparent',
              transition: 'all 0.15s',
            }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
          {error && (
            <div style={{ marginBottom: '1rem', padding: '0.65rem 0.9rem', borderRadius: 8,
                          background: '#ef444418', border: '1px solid #ef4444',
                          color: '#fca5a5', fontSize: '0.82rem' }}>
              {error}
            </div>
          )}

          {/* ── List tab ── */}
          {tab === 'list' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {datasources.map(ds => (
                <div key={ds.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '0.75rem 1rem', borderRadius: 10,
                  border: `1px solid ${ds.id === activeDsId ? T.purple : T.border}`,
                  background: ds.id === activeDsId ? `${T.purple}10` : T.bg,
                  cursor: 'pointer', transition: 'all 0.15s',
                }} onClick={() => { onSwitch(ds.id); onClose(); }}>
                  <Database size={16} color={DS_TYPE_COLOR[ds.type] ?? T.textDim} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                      <span style={{ fontWeight: 600, fontSize: '0.88rem', color: T.textPri,
                                     overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ds.name}
                      </span>
                      <DsTypeBadge type={ds.type} />
                      {ds.id === activeDsId && (
                        <span style={{ fontSize: '0.62rem', color: T.purpleHi, fontWeight: 700 }}>
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: T.textDim }}>{ds.description}</span>
                  </div>
                  {!ds.is_default && (
                    <button onClick={e => { e.stopPropagation(); onDelete(ds.id); }} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: T.textDim, lineHeight: 0, padding: 4,
                      borderRadius: 6, transition: 'color 0.15s',
                    }}
                      onMouseOver={e => e.currentTarget.style.color = '#ef4444'}
                      onMouseOut={e =>  e.currentTarget.style.color = T.textDim}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
              {datasources.length === 1 && (
                <p style={{ textAlign: 'center', color: T.textDim, fontSize: '0.82rem', paddingTop: '0.5rem' }}>
                  No custom sources yet. Upload a file or connect a database using the tabs above.
                </p>
              )}
            </div>
          )}

          {/* ── Upload file tab ── */}
          {tab === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ color: T.textMuted, fontSize: '0.85rem', margin: 0 }}>
                Upload a <strong style={{ color: T.textPri }}>CSV</strong>,{' '}
                <strong style={{ color: T.textPri }}>JSON</strong>, or{' '}
                <strong style={{ color: T.textPri }}>JSONL</strong> file.
                It will be imported into an isolated DuckDB table. Max&nbsp;50&nbsp;MB.
              </p>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${T.border2}`, borderRadius: 12,
                  padding: '2.5rem 1rem', textAlign: 'center', cursor: 'pointer',
                  color: T.textDim, fontSize: '0.88rem', transition: 'all 0.2s',
                }}
                onMouseOver={e => { e.currentTarget.style.borderColor = T.purple; e.currentTarget.style.color = T.purpleSoft; }}
                onMouseOut={e =>  { e.currentTarget.style.borderColor = T.border2; e.currentTarget.style.color = T.textDim; }}
              >
                <Upload size={28} style={{ margin: '0 auto 0.6rem' }} />
                <div>Click to choose a file</div>
                <div style={{ fontSize: '0.72rem', marginTop: 4 }}>.csv · .json · .jsonl</div>
              </div>
              <input ref={fileInputRef} type="file" accept=".csv,.json,.jsonl"
                     style={{ display: 'none' }} onChange={handleFileUpload} />
              {busy && (
                <div style={{ textAlign: 'center', color: T.textMuted, fontSize: '0.85rem',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Loader2 size={14} className="animate-spin" /> Importing data…
                </div>
              )}
            </div>
          )}

          {/* ── PostgreSQL tab ── */}
          {tab === 'postgres' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <p style={{ color: T.textMuted, fontSize: '0.85rem', margin: 0 }}>
                Selected tables will be <strong style={{ color: T.textPri }}>snapshotted</strong> into
                a local DuckDB file at connect time. Requires network access to your PostgreSQL host.
              </p>
              {[
                ['Display name',  'display_name', 'text',     'My Sales DB'],
                ['Host',          'host',         'text',     'localhost'],
                ['Port',          'port',         'text',     '5432'],
                ['Database',      'database',     'text',     'mydb'],
                ['Username',      'user',         'text',     'postgres'],
                ['Password',      'password',     'password', ''],
                ['Tables (comma-separated)', 'tables', 'text', 'public.orders, public.customers'],
              ].map(([label, key, type, ph]) => (
                <div key={key}>
                  <label style={labelStyle}>{label}</label>
                  <input
                    type={type} placeholder={ph} value={pgForm[key]}
                    onChange={e => setPgForm(f => ({ ...f, [key]: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              ))}
              <button onClick={handlePgConnect} disabled={busy} style={primaryBtn(busy)}>
                {busy ? 'Connecting…' : 'Connect & Snapshot'}
              </button>
            </div>
          )}

          {/* ── SQLite tab ── */}
          {tab === 'sqlite' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ color: T.textMuted, fontSize: '0.85rem', margin: 0 }}>
                Upload a <strong style={{ color: T.textPri }}>.db</strong> or{' '}
                <strong style={{ color: T.textPri }}>.sqlite</strong> file.
                All user tables will be snapshotted into DuckDB. Max&nbsp;50&nbsp;MB.
              </p>
              <div
                onClick={() => sqliteInputRef.current?.click()}
                style={{
                  border: `2px dashed ${T.border2}`, borderRadius: 12,
                  padding: '2.5rem 1rem', textAlign: 'center', cursor: 'pointer',
                  color: T.textDim, fontSize: '0.88rem', transition: 'all 0.2s',
                }}
                onMouseOver={e => { e.currentTarget.style.borderColor = T.purple; e.currentTarget.style.color = T.purpleSoft; }}
                onMouseOut={e =>  { e.currentTarget.style.borderColor = T.border2; e.currentTarget.style.color = T.textDim; }}
              >
                <Database size={28} style={{ margin: '0 auto 0.6rem' }} />
                <div>Click to choose a SQLite file</div>
                <div style={{ fontSize: '0.72rem', marginTop: 4 }}>.db · .sqlite</div>
              </div>
              <input ref={sqliteInputRef} type="file" accept=".db,.sqlite"
                     style={{ display: 'none' }} onChange={handleSqliteUpload} />
              {busy && (
                <div style={{ textAlign: 'center', color: T.textMuted, fontSize: '0.85rem',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Loader2 size={14} className="animate-spin" /> Importing database…
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

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
  const [input,          setInput]          = useState('');
  const [isLoading,      setIsLoading]      = useState(false);
  const [sessionId,      setSessionId]      = useState(null);

  // Panel: track by index so per-message state is correct
  const [activeIndex,    setActiveIndex]    = useState(null);
  const activeComponents = activeIndex !== null ? messages[activeIndex]?.components : null;

  // SSE progress
  const [completedSteps, setCompletedSteps] = useState([]);
  const [currentStep,    setCurrentStep]    = useState('');

  // Datasource management
  const [datasources,    setDatasources]    = useState([]);
  const [activeDsId,     setActiveDsId]     = useState('default');
  const [showDsModal,    setShowDsModal]    = useState(false);

  // Collapsible sidebar
  const [isSidebarOpen,  setIsSidebarOpen]  = useState(true);
  const [chatHistory,    setChatHistory]    = useState([
    { id: 1, title: 'Analysis: Region Volume' },
    { id: 2, title: 'Trend: CSAT Scores' },
    { id: 3, title: 'Containment Rates 2026' },
  ]);
  const [activeChatId,   setActiveChatId]   = useState(1);

  // Resizable right panel
  const [panelWidth,     setPanelWidth]     = useState(480);
  const [isDragging,     setIsDragging]     = useState(false);

  const currentStepRef = useRef('');
  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  // Panel drag-to-resize
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const newWidth = document.body.clientWidth - e.clientX;
      if (newWidth > 300 && newWidth < 900) setPanelWidth(newWidth);
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
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

  const fetchDatasources = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/datasource');
      if (res.ok) setDatasources(await res.json());
    } catch { /* backend not reachable */ }
  };

  useEffect(() => { fetchDatasources(); }, []);

  const handleDeleteDs = async (dsId) => {
    try {
      await fetch(`http://localhost:8000/api/datasource/${dsId}`, { method: 'DELETE' });
      if (activeDsId === dsId) setActiveDsId('default');
      await fetchDatasources();
    } catch { /* ignore */ }
  };

  const handleSwitchDs = async (newId) => {
    if (newId === activeDsId) return;
    const ds = datasources.find(d => d.id === newId);
    if (sessionId) {
      try {
        await fetch(`http://localhost:8000/api/session/reset?session_id=${sessionId}`, { method: 'POST' });
      } catch { /* backend unreachable — continue anyway */ }
    }
    setActiveDsId(newId);
    if (ds) {
      setMessages(prev => [...prev, { role: 'separator', dsName: ds.name, dsType: ds.type }]);
    }
  };

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

  // ── API call — SSE streaming ──
  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    const snapshotDs  = datasources.find(d => d.id === activeDsId);
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
        body: JSON.stringify({ message: userMessage, session_id: sessionId, datasource_id: activeDsId }),
      });

      if (!response.ok || !response.body) throw new Error(`Server error ${response.status}`);

      const reader  = response.body.getReader();
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
            if (currentStepRef.current) {
              const done = currentStepRef.current;
              setCompletedSteps(s => [...s, done]);
            }
            currentStepRef.current = event.message;
            setCurrentStep(event.message);

          } else if (event.type === 'result') {
            if (event.session_id) setSessionId(event.session_id);
            const components = event.components?.length ? event.components : null;
            setMessages(prev => {
              const next = [...prev, {
                role: 'assistant',
                text: event.reply || 'Here is the data you requested.',
                components,
                suggestions: event.suggestions || [],
                dsName: snapshotDs?.name,
                dsType: snapshotDs?.type,
              }];
              if (components) setActiveIndex(next.length - 1);
              return next;
            });

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
        text: "Oops! We couldn't connect to the server right now. Please make sure the backend is running and try again.",
        components: null,
      }]);
    } finally {
      setIsLoading(false);
      setCompletedSteps([]);
      setCurrentStep('');
      currentStepRef.current = '';
    }
  };

  const activeDs = datasources.find(d => d.id === activeDsId);

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: T.bg,
                  color: T.textPri, fontFamily: 'system-ui, -apple-system, sans-serif',
                  overflow: 'hidden' }}>

      {showDsModal && (
        <DataSourceModal
          datasources={datasources}
          activeDsId={activeDsId}
          onSwitch={handleSwitchDs}
          onDelete={handleDeleteDs}
          onClose={() => setShowDsModal(false)}
          onRefresh={fetchDatasources}
        />
      )}

      {/* ── LEFT SIDEBAR (Collapsible) ── */}
      <div style={{
        width: isSidebarOpen ? 260 : 0,
        flexShrink: 0,
        backgroundColor: '#000000',
        borderRight: isSidebarOpen ? `1px solid ${T.border}` : 'none',
        transition: 'width 0.3s ease',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 260, flex: 1 }}>
          <button style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: T.surface,
            color: T.textPri, padding: '0.75rem 1rem', borderRadius: 8, border: `1px solid ${T.border2}`,
            cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, transition: 'all 0.2s', justifyContent: 'center',
          }}
            onMouseOver={e => e.currentTarget.style.borderColor = T.purpleSoft}
            onMouseOut={e =>  e.currentTarget.style.borderColor = T.border2}
          >
            <Plus size={18} /> New Chat
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '0.75rem', color: T.textDim, textTransform: 'uppercase',
                         letterSpacing: '0.05em', marginBottom: '0.5rem', paddingLeft: '0.5rem' }}>
              Chat History
            </h3>
            {chatHistory.map(chat => (
              <button key={chat.id} onClick={() => setActiveChatId(chat.id)} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem',
                backgroundColor: activeChatId === chat.id ? T.surface : 'transparent',
                border: 'none', borderRadius: 8,
                color: activeChatId === chat.id ? T.textPri : T.textMuted,
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
              }}>
                <MessageSquare size={16} />
                <span style={{ fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {chat.title}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN: Chat ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Header */}
        <header style={{ backgroundColor: T.bg, padding: '1.5rem',
                         borderBottom: `1px solid ${T.border}`,
                         display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer',
                             display: 'flex', alignItems: 'center' }}
                    onMouseOver={e => e.currentTarget.style.color = T.textPri}
                    onMouseOut={e =>  e.currentTarget.style.color = T.textMuted}>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Datasource selector */}
            {datasources.length > 0 && (() => {
              const active = datasources.find(d => d.id === activeDsId) ?? datasources[0];
              return (
                <button onClick={() => setShowDsModal(true)} style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '0.45rem 0.8rem', borderRadius: 8, cursor: 'pointer',
                  background: T.surface, border: `1px solid ${T.border2}`,
                  color: T.textMuted, fontSize: '0.8rem', transition: 'all 0.2s',
                  maxWidth: 200,
                }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = T.purple; e.currentTarget.style.color = T.purpleSoft; }}
                  onMouseOut={e =>  { e.currentTarget.style.borderColor = T.border2; e.currentTarget.style.color = T.textMuted; }}
                >
                  <Database size={13} color={DS_TYPE_COLOR[active.type] ?? T.textDim} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                    {active.name}
                  </span>
                  <ChevronDown size={12} />
                </button>
              );
            })()}

            {/* Add datasource */}
            <button onClick={() => setShowDsModal(true)} title="Add data source" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0.45rem', borderRadius: 8, cursor: 'pointer',
              background: T.surface, border: `1px solid ${T.border2}`,
              color: T.textMuted, transition: 'all 0.2s',
            }}
              onMouseOver={e => { e.currentTarget.style.borderColor = T.purple; e.currentTarget.style.color = T.purpleSoft; }}
              onMouseOut={e =>  { e.currentTarget.style.borderColor = T.border2; e.currentTarget.style.color = T.textMuted; }}
            >
              <Plus size={16} />
            </button>

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
          </div>
        </header>

        {/* Active datasource banner — only when NOT on the default dataset */}
        {activeDs && !activeDs.is_default && (
          <div style={{
            padding: '0.5rem 1.5rem', borderBottom: `1px solid ${T.border}`,
            background: `${DS_TYPE_COLOR[activeDs.type] ?? T.purple}12`,
            display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem',
          }}>
            <Database size={12} color={DS_TYPE_COLOR[activeDs.type] ?? T.purpleHi} />
            <span style={{ color: T.textMuted }}>
              Querying <strong style={{ color: T.textPri }}>{activeDs.name}</strong>
              {' '}·{' '}{activeDs.description}
            </span>
            <button onClick={() => setShowDsModal(true)} style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              color: T.textDim, cursor: 'pointer', fontSize: '0.75rem',
              textDecoration: 'underline',
            }}>
              Switch
            </button>
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
          <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {messages.map((msg, idx) => {
              // ── Separator: datasource switch marker ──
              if (msg.role === 'separator') {
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, height: 1, background: T.border }} />
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
                      fontSize: '0.7rem', color: T.textDim,
                      padding: '3px 10px', borderRadius: 20,
                      border: `1px solid ${T.border}`, background: T.surface,
                    }}>
                      <Database size={10} color={DS_TYPE_COLOR[msg.dsType] ?? T.textDim} />
                      Now querying <strong style={{ color: T.textPri, fontWeight: 600 }}>{msg.dsName}</strong>
                    </span>
                    <div style={{ flex: 1, height: 1, background: T.border }} />
                  </div>
                );
              }

              // ── Normal message bubble ──
              return (
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

                    {/* Datasource badge on assistant messages */}
                    {msg.role === 'assistant' && msg.dsName && (
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Database size={10} color={DS_TYPE_COLOR[msg.dsType] ?? T.textDim} />
                        <span style={{ fontSize: '0.65rem', color: T.textDim }}>{msg.dsName}</span>
                      </div>
                    )}

                    {/* "View Dashboard" button — only shown when this message's panel is not active */}
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
                        onMouseOut={e =>  e.currentTarget.style.borderColor = T.border2}
                      >
                        <BarChart2 size={16} />
                        {panelLabel(msg.components)}
                      </button>
                    )}

                    {/* Suggested follow-up questions */}
                    {msg.role === 'assistant' && msg.suggestions?.length > 0 && (
                      <div style={{ marginTop: '1.1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: '0.5rem' }}>
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
              );
            })}

            {/* SSE progress feed */}
            {isLoading && (
              <div style={{ display: 'flex', gap: '1rem', paddingLeft: '4rem' }}>
                <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 12,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              backgroundColor: T.border, color: T.textMuted }}>
                  <Bot size={20} />
                </div>
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
            {/* Paperclip opens datasource modal for file upload */}
            <button type="button" title="Add data source" onClick={() => setShowDsModal(true)} style={{
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

      {/* ── RIGHT: Data Inspector Panel (Resizable) ── */}
      {activeComponents && (
        <div style={{
          width: panelWidth,
          borderLeft: `1px solid ${T.border}`,
          backgroundColor: T.bg, display: 'flex', flexDirection: 'column',
          position: 'relative',
          animation: 'slideIn 0.25s ease-out',
        }}>
          {/* Drag handle */}
          <div
            onMouseDown={() => setIsDragging(true)}
            style={{
              position: 'absolute', left: -8, top: 0, bottom: 0, width: 16,
              cursor: 'col-resize', display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'transparent', zIndex: 10,
            }}
          >
            <div style={{ position: 'absolute', left: 7, top: 0, bottom: 0, width: 2,
                          backgroundColor: isDragging ? T.purple : 'transparent',
                          transition: 'background-color 0.2s' }} />
            <div style={{
              backgroundColor: T.surface, border: `1px solid ${T.border}`, borderRadius: 4, padding: 2, zIndex: 11,
              color: isDragging ? T.purpleSoft : T.textDim, opacity: isDragging ? 1 : 0.8, transition: 'all 0.2s',
            }}>
              <GripVertical size={14} />
            </div>
          </div>

          {/* Panel header */}
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

          {/* Panel body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
            <DashboardComponents components={activeComponents} />

            {/* Raw data table below charts */}
            {activeComponents.some(c => c.type !== 'table' && c.type !== 'kpi' && c.data) && (
              <div style={{ marginTop: '3rem', borderTop: `1px solid ${T.border}`, paddingTop: '1.5rem' }}>
                <h3 style={{ fontSize: '0.85rem', color: T.textDim, textTransform: 'uppercase',
                             letterSpacing: '0.05em', marginBottom: '1rem' }}>
                  Raw Data Overview
                </h3>
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
