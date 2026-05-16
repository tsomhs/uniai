import React, { useState, useRef, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
  AreaChart, Area, ReferenceLine,
  ScatterChart, Scatter, ZAxis,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import {
  Send, User, Bot, Loader2, X, BarChart2, Paperclip, Check, Sparkles,
  Database, Upload, Plus, Trash2, ChevronDown, Link,
  GripVertical, Menu, MessageSquare, ChevronRight, ChevronLeft,
  Download, Copy, Share2, LogOut, BookOpen,
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

// ─── i18n ─────────────────────────────────────────────────────────────────────

const I18N = {
  en: {
    appTitle:        'Speak With Your Data',
    appSubtitle:     'by Prompt Masters',
    testMode:        'Test Mode',
    newChat:         'New Chat',
    chatHistory:     'Chat History',
    placeholder:     'Ask a question about your data…',
    exploreFurther:  'Explore further',
    dataInspector:   'Data Inspector',
    rawData:         'Raw Data Overview',
    switchBtn:       'Switch',
    querying:        'Querying',
    nowQuerying:     'Now querying',
    connecting:      'Connecting…',
    addSource:       'Add data source',
    active:          'ACTIVE',
    noCustomSources: 'No custom sources yet. Upload a file or connect a database using the tabs above.',
    greeting: (h) => h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening',
    welcomeSub:      'What would you like to explore today?',
    suggestions: [
      'What is the overall containment rate?',
      'Show me the top 5 customer intents',
      'Compare CSAT scores by customer segment',
      'Which bot version has better performance?',
      'Show the weekly call volume trend',
    ],
    modal: {
      title:        'Data Sources',
      mySources:    'My Sources',
      uploadFile:   'Upload File',
      postgres:     'PostgreSQL',
      sqlite:       'SQLite',
      uploadDesc:   'Upload a CSV, JSON, or JSONL file. It will be imported into an isolated DuckDB table. Max 100 MB.',
      clickFile:    'Click to choose a file',
      fileTypes:    '.csv · .json · .jsonl',
      importing:    'Importing data…',
      pgDesc:       'Selected tables will be snapshotted into a local DuckDB file at connect time. Requires network access to your PostgreSQL host.',
      pgFields:     [
        ['Display name', 'display_name', 'text',     'My Sales DB'],
        ['Host',         'host',         'text',     'localhost'],
        ['Port',         'port',         'text',     '5432'],
        ['Database',     'database',     'text',     'mydb'],
        ['Username',     'user',         'text',     'postgres'],
        ['Password',     'password',     'password', ''],
        ['Tables (comma-separated)', 'tables', 'text', 'public.orders, public.customers'],
      ],
      connectBtn:      'Connect & Snapshot',
      connectingBtn:   'Connecting…',
      sqliteDesc:      'Upload a .db or .sqlite file. All user tables will be snapshotted into DuckDB. Max 100 MB.',
      clickSqlite:     'Click to choose a SQLite file',
      sqliteTypes:     '.db · .sqlite',
      importingDb:     'Importing database…',
    },
  },
  el: {
    appTitle:        'Μίλα με τα Δεδομένα σου',
    appSubtitle:     'από τους Prompt Masters',
    testMode:        'Δοκιμαστική Λειτουργία',
    newChat:         'Νέα Συνομιλία',
    chatHistory:     'Ιστορικό Συνομιλιών',
    placeholder:     'Κάνε μια ερώτηση για τα δεδομένα σου…',
    exploreFurther:  'Εξερεύνησε περαιτέρω',
    dataInspector:   'Επιθεωρητής Δεδομένων',
    rawData:         'Επισκόπηση Ακατέργαστων Δεδομένων',
    switchBtn:       'Αλλαγή',
    querying:        'Αναζήτηση σε',
    nowQuerying:     'Τώρα αναζητούμε',
    connecting:      'Σύνδεση…',
    addSource:       'Προσθήκη πηγής δεδομένων',
    active:          'ΕΝΕΡΓΗ',
    noCustomSources: 'Δεν υπάρχουν προσαρμοσμένες πηγές. Ανεβάστε αρχείο ή συνδεθείτε σε βάση δεδομένων.',
    greeting: (h) => h < 12 ? 'Καλημέρα' : h < 18 ? 'Καλό απόγευμα' : 'Καλό βράδυ',
    welcomeSub:      'Τι θα ήθελες να εξερευνήσεις σήμερα;',
    suggestions: [
      'Ποιο είναι το συνολικό ποσοστό συγκράτησης;',
      'Δείξε μου τα 5 πιο συχνά αιτήματα πελατών',
      'Σύγκρινε τις βαθμολογίες CSAT ανά τμήμα πελατών',
      'Ποια έκδοση bot έχει καλύτερη απόδοση;',
      'Εμφάνισε την εβδομαδιαία τάση όγκου κλήσεων',
    ],
    modal: {
      title:        'Πηγές Δεδομένων',
      mySources:    'Οι Πηγές μου',
      uploadFile:   'Μεταφόρτωση Αρχείου',
      postgres:     'PostgreSQL',
      sqlite:       'SQLite',
      uploadDesc:   'Ανεβάστε αρχείο CSV, JSON ή JSONL. Θα εισαχθεί σε απομονωμένο πίνακα DuckDB. Μέγ. 100 MB.',
      clickFile:    'Κάντε κλικ για επιλογή αρχείου',
      fileTypes:    '.csv · .json · .jsonl',
      importing:    'Εισαγωγή δεδομένων…',
      pgDesc:       'Οι επιλεγμένοι πίνακες θα αποθηκευτούν τοπικά κατά τη σύνδεση. Απαιτείται πρόσβαση στον PostgreSQL host σας.',
      pgFields:     [
        ['Εμφανιζόμενο όνομα', 'display_name', 'text',     'Βάση Δεδομένων μου'],
        ['Host',               'host',         'text',     'localhost'],
        ['Port',               'port',         'text',     '5432'],
        ['Βάση δεδομένων',     'database',     'text',     'mydb'],
        ['Χρήστης',            'user',         'text',     'postgres'],
        ['Κωδικός',            'password',     'password', ''],
        ['Πίνακες (διαχωρισμένοι με κόμμα)', 'tables', 'text', 'public.orders, public.customers'],
      ],
      connectBtn:      'Σύνδεση & Αποθήκευση',
      connectingBtn:   'Σύνδεση…',
      sqliteDesc:      'Ανεβάστε αρχείο .db ή .sqlite. Όλοι οι πίνακες θα εισαχθούν σε DuckDB. Μέγ. 100 MB.',
      clickSqlite:     'Κάντε κλικ για επιλογή αρχείου SQLite',
      sqliteTypes:     '.db · .sqlite',
      importingDb:     'Εισαγωγή βάσης δεδομένων…',
    },
  },
};

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

// ─── Chart export utilities ───────────────────────────────────────────────────

function exportSvgToPng(containerEl, filename) {
  const svg = containerEl?.querySelector('svg');
  if (!svg) return;
  const { width, height } = svg.getBoundingClientRect();
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', width);
  clone.setAttribute('height', height);
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', '100%'); bg.setAttribute('height', '100%'); bg.setAttribute('fill', T.bg);
  clone.insertBefore(bg, clone.firstChild);
  const svgStr = new XMLSerializer().serializeToString(clone);
  const blob   = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url    = URL.createObjectURL(blob);
  const img    = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const scale  = 2;
    canvas.width  = width  * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = T.bg;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);
    canvas.toBlob(b => {
      const a = document.createElement('a');
      a.href     = URL.createObjectURL(b);
      a.download = `${filename.replace(/[^a-z0-9]/gi, '_')}.png`;
      a.click();
    });
  };
  img.src = url;
}

function copyAsTsv(data) {
  if (!data?.length) return Promise.resolve(false);
  const cols = Object.keys(data[0]);
  const tsv  = [cols, ...data.map(row => cols.map(c => row[c] ?? ''))].map(r => r.join('\t')).join('\n');
  return navigator.clipboard.writeText(tsv).then(() => true).catch(() => false);
}

function generateHtmlReport(components, title) {
  const rows = (data) => (data ?? []).map(row =>
    `<tr>${Object.values(row).map(v => `<td>${typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 4 }) : v ?? ''}</td>`).join('')}</tr>`
  ).join('');
  const tables = components.map(c => {
    if (!c.data?.length) return '';
    const cols = Object.keys(c.data[0]);
    return `<section><h2>${c.title ?? ''}</h2>${c.subtitle ? `<p class="sub">${c.subtitle}</p>` : ''}
      <table><thead><tr>${cols.map(col => `<th>${col.replace(/_/g, ' ')}</th>`).join('')}</tr></thead>
      <tbody>${rows(c.data)}</tbody></table></section>`;
  }).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>${title ?? 'Data Report'}</title>
  <style>
    body{font-family:system-ui,sans-serif;margin:40px;color:#111}
    h1{font-size:1.4rem;margin-bottom:4px}h2{font-size:1.1rem;margin:2rem 0 4px}
    .sub{color:#666;font-size:.85rem;margin:0 0 10px}
    table{border-collapse:collapse;width:100%;font-size:.85rem;margin-top:.5rem}
    th{background:#f0f0f0;padding:8px 12px;text-align:left;font-weight:600;text-transform:capitalize}
    td{padding:7px 12px;border-bottom:1px solid #e5e5e5}
    section{margin-bottom:2rem}
    @media print{body{margin:20px}}
  </style></head>
  <body><h1>${title ?? 'Data Report'}</h1><p class="sub">Generated ${new Date().toLocaleString()}</p>
  ${tables}</body></html>`;
}

// ─── Data-citation modal ──────────────────────────────────────────────────────

function SourcePopover({ source, onClose }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    const [file, anchor] = source.split('#');
    if (!file || !anchor) { setError('Malformed citation.'); setLoading(false); return; }
    fetch(`http://localhost:8000/api/source/section?file=${encodeURIComponent(file)}&anchor=${encodeURIComponent(anchor)}`, {
      credentials: 'include',
    })
      .then(async r => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.detail || `Could not load (${r.status})`);
        }
        return r.json();
      })
      .then(d => { setContent(d); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [source]);

  return (
    <div style={{ marginTop: 8, borderRadius: 10, border: `1px solid ${T.purple}50`, background: T.bg, overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: `${T.purple}14` }}>
        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: T.purpleSoft, display: 'flex', alignItems: 'center', gap: 6 }}>
          <BookOpen size={12} /> {source}
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer', display: 'flex' }}><X size={14} /></button>
      </div>
      <div style={{ padding: '10px 14px', maxHeight: 260, overflowY: 'auto', fontSize: '0.78rem', color: T.textPri, lineHeight: 1.55, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {loading && <span style={{ color: T.textDim }}>Loading…</span>}
        {error   && <span style={{ color: '#fca5a5' }}>{error}</span>}
        {content && content.content}
      </div>
    </div>
  );
}

function DataCitationModal({ title, data, sql, sources, onClose }) {
  const [view, setView]           = useState('table'); // 'table' | 'browse' | 'json'
  const [rowIndex, setRowIndex]   = useState(0);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [dataCopied, setDataCopied] = useState(false);
  const [openSource, setOpenSource] = useState(null);

  const cols  = data?.length ? Object.keys(data[0]) : [];
  const total = data?.length ?? 0;

  const prev = () => setRowIndex(i => Math.max(0, i - 1));
  const next = () => setRowIndex(i => Math.min(total - 1, i + 1));

  useEffect(() => {
    if (view !== 'browse') return;
    const handler = (e) => {
      if (e.key === 'ArrowLeft')  prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [view, total]);

  const copySql = () =>
    navigator.clipboard.writeText(sql || '').then(() => {
      setSqlCopied(true); setTimeout(() => setSqlCopied(false), 1800);
    });

  const copyData = () => {
    const text = view === 'json'
      ? JSON.stringify(data, null, 2)
      : view === 'browse'
        ? JSON.stringify(data[rowIndex], null, 2)
        : [cols.join('\t'), ...data.map(r => cols.map(c => r[c] ?? '').join('\t'))].join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setDataCopied(true); setTimeout(() => setDataCopied(false), 1800);
    });
  };

  const pill = (id, label) => (
    <button onClick={() => { setView(id); setRowIndex(0); }} style={{
      padding: '0.3rem 0.8rem', borderRadius: 999, border: 'none', cursor: 'pointer',
      fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.15s',
      background: view === id ? T.purple : 'transparent',
      color: view === id ? '#fff' : T.textMuted,
    }}>{label}</button>
  );

  const navBtn = (onClick, disabled, icon) => (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: 32, height: 32, borderRadius: 8, border: `1px solid ${disabled ? T.border : T.border2}`,
      background: disabled ? 'transparent' : T.surface,
      color: disabled ? T.border2 : T.textMuted, cursor: disabled ? 'default' : 'pointer',
      transition: 'all 0.15s', flexShrink: 0,
    }}
    onMouseOver={e => { if (!disabled) { e.currentTarget.style.borderColor = T.purple; e.currentTarget.style.color = T.purpleSoft; } }}
    onMouseOut={e =>  { if (!disabled) { e.currentTarget.style.borderColor = T.border2; e.currentTarget.style.color = T.textMuted; } }}>
      {icon}
    </button>
  );

  const fmtVal = v => typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 4 }) : String(v ?? '—');

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '90vw', maxWidth: 780, maxHeight: '85vh', borderRadius: 20, background: T.surface, border: `1px solid ${T.border2}`, boxShadow: '0 24px 80px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={15} color={T.purpleSoft} />
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: T.textPri }}>{title}</span>
            <span style={{ fontSize: '0.72rem', color: T.textDim, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: '1px 7px' }}>{total} rows</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* SQL section */}
          {sql && (
            <div style={{ padding: '0.85rem 1.25rem', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textDim }}>SQL Query</span>
                <button onClick={copySql} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 6, border: `1px solid ${sqlCopied ? '#10b981' : T.border}`, background: T.bg, color: sqlCopied ? '#10b981' : T.textMuted, cursor: 'pointer', fontSize: '0.7rem', transition: 'all 0.15s' }}>
                  {sqlCopied ? <Check size={11} /> : <Copy size={11} />}{sqlCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre style={{ margin: 0, padding: '0.75rem 1rem', borderRadius: 10, background: T.bg, border: `1px solid ${T.border}`, fontSize: '0.76rem', color: '#a5f3fc', overflowX: 'auto', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{sql}</pre>
            </div>
          )}

          {/* Sources section */}
          {Array.isArray(sources) && sources.length > 0 && (
            <div style={{ padding: '0.85rem 1.25rem', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <BookOpen size={12} color={T.purpleSoft} />
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textDim }}>
                  Sources ({sources.length})
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {sources.map((src, i) => {
                  const active = openSource === src;
                  return (
                    <button key={i}
                      onClick={() => setOpenSource(active ? null : src)}
                      title={`Open ${src}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '4px 10px', borderRadius: 999,
                        border: `1px solid ${active ? T.purple : T.border2}`,
                        background: active ? `${T.purple}25` : T.bg,
                        color: active ? T.purpleHi : T.purpleSoft,
                        cursor: 'pointer', fontSize: '0.72rem',
                        fontFamily: 'ui-monospace, Menlo, monospace',
                        transition: 'all 0.15s',
                      }}
                      onMouseOver={e => { if (!active) { e.currentTarget.style.borderColor = T.purple; e.currentTarget.style.color = T.purpleHi; } }}
                      onMouseOut={e =>  { if (!active) { e.currentTarget.style.borderColor = T.border2; e.currentTarget.style.color = T.purpleSoft; } }}>
                      <BookOpen size={11} /> {src}
                    </button>
                  );
                })}
              </div>
              {openSource && <SourcePopover source={openSource} onClose={() => setOpenSource(null)} />}
            </div>
          )}

          {/* Data section */}
          <div style={{ padding: '0.85rem 1.25rem', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              {/* View toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 999, padding: '3px 4px' }}>
                {pill('table',  'Table')}
                {pill('browse', 'Browse')}
                {pill('json',   'JSON')}
              </div>
              <button onClick={copyData} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 6, border: `1px solid ${dataCopied ? '#10b981' : T.border}`, background: T.bg, color: dataCopied ? '#10b981' : T.textMuted, cursor: 'pointer', fontSize: '0.7rem', transition: 'all 0.15s' }}>
                {dataCopied ? <Check size={11} /> : <Copy size={11} />}
                {dataCopied ? 'Copied!' : view === 'browse' ? 'Copy record' : view === 'json' ? 'Copy JSON' : 'Copy TSV'}
              </button>
            </div>

            {/* ── Table view ── */}
            {view === 'table' && (
              <div style={{ borderRadius: 10, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto', maxHeight: '38vh' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.79rem' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                      <tr style={{ background: T.bg }}>
                        <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, color: T.textDim, borderBottom: `1px solid ${T.border}`, width: 40, fontSize: '0.68rem' }}>#</th>
                        {cols.map(c => <th key={c} style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, color: T.textMuted, whiteSpace: 'nowrap', textTransform: 'capitalize', borderBottom: `1px solid ${T.border}` }}>{c.replace(/_/g, ' ')}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((row, i) => (
                        <tr key={i} onClick={() => { setRowIndex(i); setView('browse'); }}
                            style={{ background: i % 2 === 0 ? T.surface : T.bg, cursor: 'pointer', transition: 'background 0.1s' }}
                            onMouseOver={e => e.currentTarget.style.background = `${T.purple}18`}
                            onMouseOut={e => e.currentTarget.style.background = i % 2 === 0 ? T.surface : T.bg}>
                          <td style={{ padding: '6px 10px', color: T.textDim, borderBottom: `1px solid ${T.border}`, fontSize: '0.68rem' }}>{i + 1}</td>
                          {cols.map(c => <td key={c} style={{ padding: '6px 12px', color: T.textPri, borderBottom: `1px solid ${T.border}` }}>{fmtVal(row[c])}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: '6px 12px', background: T.bg, borderTop: `1px solid ${T.border}`, fontSize: '0.68rem', color: T.textDim }}>
                  Click any row to inspect it in Browse view
                </div>
              </div>
            )}

            {/* ── Browse view ── */}
            {view === 'browse' && total > 0 && (
              <div>
                {/* Navigation bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  {navBtn(prev, rowIndex === 0, <ChevronLeft size={15} />)}
                  <span style={{ fontSize: '0.8rem', color: T.textMuted, fontWeight: 600 }}>
                    Record <span style={{ color: T.purpleSoft }}>{rowIndex + 1}</span> of {total}
                  </span>
                  {navBtn(next, rowIndex === total - 1, <ChevronRight size={15} />)}
                  <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: T.textDim }}>← → arrow keys also work</span>
                </div>

                {/* Record card */}
                <div style={{ borderRadius: 12, border: `1px solid ${T.border2}`, overflow: 'hidden' }}>
                  {cols.map((c, i) => {
                    const v = data[rowIndex][c];
                    const isNum = typeof v === 'number';
                    return (
                      <div key={c} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', background: i % 2 === 0 ? T.bg : T.surface, borderBottom: i < cols.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                        <div style={{ padding: '9px 14px', fontSize: '0.76rem', fontWeight: 600, color: T.textMuted, textTransform: 'capitalize', borderRight: `1px solid ${T.border}`, display: 'flex', alignItems: 'center' }}>
                          {c.replace(/_/g, ' ')}
                        </div>
                        <div style={{ padding: '9px 14px', fontSize: '0.82rem', color: isNum ? T.purpleSoft : T.textPri, fontWeight: isNum ? 600 : 400, display: 'flex', alignItems: 'center', wordBreak: 'break-all' }}>
                          {fmtVal(v)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Mini progress bar */}
                <div style={{ marginTop: 10, height: 3, borderRadius: 999, background: T.border, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 999, background: T.purple, width: `${((rowIndex + 1) / total) * 100}%`, transition: 'width 0.2s' }} />
                </div>
              </div>
            )}

            {/* ── JSON view ── */}
            {view === 'json' && (
              <pre style={{ margin: 0, padding: '0.75rem 1rem', borderRadius: 10, background: T.bg, border: `1px solid ${T.border}`, fontSize: '0.74rem', color: '#86efac', overflowX: 'auto', maxHeight: '38vh', overflowY: 'auto', lineHeight: 1.55 }}>
                {JSON.stringify(data, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Chart action toolbar ─────────────────────────────────────────────────────

function ChartToolbar({ containerRef, title, data, sql, sources }) {
  const [copied, setCopied]   = useState(false);
  const [showCite, setShowCite] = useState(false);

  const handlePng = () => exportSvgToPng(containerRef.current, title || 'chart');

  const handleCopy = async () => {
    const ok = await copyAsTsv(data);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1800); }
  };

  const btnStyle = {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '4px 10px', borderRadius: 6, border: `1px solid ${T.border}`,
    background: T.surface, color: T.textMuted, cursor: 'pointer',
    fontSize: '0.72rem', fontWeight: 500, transition: 'all 0.15s',
  };

  return (
    <>
      {showCite && <DataCitationModal title={title} data={data} sql={sql} sources={sources} onClose={() => setShowCite(false)} />}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.5rem' }}>
        {(sql || data?.length) && (
          <button style={{ ...btnStyle, borderColor: T.border2, color: T.purpleSoft }} onClick={() => setShowCite(true)}
                  onMouseOver={e => { e.currentTarget.style.borderColor = T.purple; e.currentTarget.style.color = T.purpleHi; }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = T.border2; e.currentTarget.style.color = T.purpleSoft; }}
                  title="View source data and SQL query">
            <Database size={12} /> Cite Source
          </button>
        )}
        <button style={btnStyle} onClick={handlePng}
                onMouseOver={e => { e.currentTarget.style.borderColor = T.purpleSoft; e.currentTarget.style.color = T.textPri; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMuted; }}
                title="Save chart as PNG">
          <Download size={12} /> Save PNG
        </button>
        <button style={{ ...btnStyle, ...(copied ? { borderColor: '#10b981', color: '#10b981' } : {}) }}
                onClick={handleCopy}
                onMouseOver={e => { if (!copied) { e.currentTarget.style.borderColor = T.purpleSoft; e.currentTarget.style.color = T.textPri; } }}
                onMouseOut={e => { if (!copied) { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMuted; } }}
                title="Copy data as TSV — paste directly into Excel">
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied!' : 'Copy for Excel'}
        </button>
      </div>
    </>
  );
}

function ChartWrapper({ title, data, sql, sources, children }) {
  const ref = useRef(null);
  return (
    <div ref={ref}>
      {children}
      <ChartToolbar containerRef={ref} title={title} data={data} sql={sql} sources={sources} />
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
      border: `2px solid ${color}`, borderRadius: 12,
      padding: '0.9rem 1.1rem', background: `${color}18`,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.textMuted }}>{title}</span>
      <span style={{ fontSize: '2rem', fontWeight: 800, color, lineHeight: 1.1 }}>{displayValue(raw, fmt)}</span>
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
    const r = innerRadius + (outerRadius - innerRadius) * 0.58;
    const x = cx + r * Math.cos(-midAngle * RAD);
    const y = cy + r * Math.sin(-midAngle * RAD);
    return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700}>{((value / total) * 100).toFixed(1)}%</text>;
  };
  return (
    <ChartWrapper title={title} data={data} sql={component.sql} sources={component.sources}>
      <div style={{ marginTop: '1rem' }}>
        <ChartHeader title={title} subtitle={subtitle} />
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} labelLine={false} label={renderLabel} stroke={T.bg} strokeWidth={3}>
              {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: T.purpleSoft }} formatter={v => [v.toLocaleString(), '']} />
            <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: '0.78rem', color: T.textMuted, paddingTop: 8 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartWrapper>
  );
}

// ─── Bar ──────────────────────────────────────────────────────────────────────

function BarComponent({ component }) {
  const { title, subtitle, data, format: fmt } = component;
  const thr    = fmt?.thresholds;
  const rotate = data.length > 7;
  const domain = fmt?.unit === '%' ? [0, 1] : ['auto', 'auto'];
  return (
    <ChartWrapper title={title} data={data} sql={component.sql} sources={component.sources}>
      <div style={{ marginTop: '1rem' }}>
        <ChartHeader title={title} subtitle={subtitle} />
        <ResponsiveContainer width="100%" height={rotate ? 350 : 285}>
          <BarChart data={data} margin={{ top: 12, right: 20, left: 8, bottom: rotate ? 90 : 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
            <XAxis dataKey="name" tickFormatter={formatXLabel} tick={AXIS_TICK} angle={rotate ? -42 : 0} textAnchor={rotate ? 'end' : 'middle'} interval={0} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => displayValue(v, fmt)} domain={domain} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <Tooltip labelFormatter={formatXLabel} formatter={v => [displayValue(v, fmt), '']} contentStyle={TOOLTIP_STYLE} cursor={{ fill: `${T.border}80` }} />
            {thr && <ReferenceLine y={thr.good} stroke={thr.good_color} strokeDasharray="6 3" label={{ value: `Target ${displayValue(thr.good, fmt)}`, position: 'insideTopRight', fontSize: 10, fill: thr.good_color }} />}
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {data.map((row, i) => <Cell key={i} fill={thresholdColor(row.value, thr)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartWrapper>
  );
}

// ─── Line ─────────────────────────────────────────────────────────────────────

function LineComponent({ component }) {
  const { title, subtitle, data, format: fmt } = component;
  return (
    <ChartWrapper title={title} data={data} sql={component.sql} sources={component.sources}>
      <div style={{ marginTop: '1rem' }}>
        <ChartHeader title={title} subtitle={subtitle} />
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 8, right: 20, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
            <XAxis dataKey="name" tickFormatter={formatXLabel} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => displayValue(v, fmt)} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <Tooltip labelFormatter={formatXLabel} formatter={v => [displayValue(v, fmt), '']} contentStyle={TOOLTIP_STYLE} />
            <Line type="monotone" dataKey="value" stroke={T.purpleHi} strokeWidth={3} dot={{ r: 3, fill: T.purpleHi }} activeDot={{ r: 5, fill: T.purpleSoft }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartWrapper>
  );
}

// ─── Area ─────────────────────────────────────────────────────────────────────

function AreaComponent({ component }) {
  const { title, subtitle, data, format: fmt } = component;
  return (
    <ChartWrapper title={title} data={data} sql={component.sql} sources={component.sources}>
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
            <XAxis dataKey="name" tickFormatter={formatXLabel} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => displayValue(v, fmt)} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <Tooltip labelFormatter={formatXLabel} formatter={v => [displayValue(v, fmt), '']} contentStyle={TOOLTIP_STYLE} />
            <Area type="monotone" dataKey="value" stroke={T.purpleHi} strokeWidth={3} fill="url(#areaGrad)" dot={{ r: 3, fill: T.purpleHi }} activeDot={{ r: 5, fill: T.purpleSoft }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartWrapper>
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
              {cols.map(c => <th key={c} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: T.textMuted, whiteSpace: 'nowrap', textTransform: 'capitalize' }}>{c.replace(/_/g, ' ')}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? T.surface : T.bg, borderBottom: `1px solid ${T.border}` }}>
                {cols.map(c => <td key={c} style={{ padding: '8px 12px', color: T.textPri }}>{typeof row[c] === 'number' ? row[c].toLocaleString(undefined, { maximumFractionDigits: 4 }) : String(row[c] ?? '')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Scatter ──────────────────────────────────────────────────────────────────

function ScatterComponent({ component }) {
  const { title, subtitle, data, format: fmt } = component;
  return (
    <ChartWrapper title={title} data={data} sql={component.sql} sources={component.sources}>
      <div style={{ marginTop: '1rem' }}>
        <ChartHeader title={title} subtitle={subtitle} />
        <ResponsiveContainer width="100%" height={280}>
          <ScatterChart margin={{ top: 12, right: 24, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
            <XAxis dataKey="x" type="number" name="x" tickFormatter={v => displayValue(v, fmt)} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis dataKey="y" type="number" name="y" tickFormatter={v => displayValue(v, fmt)} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <ZAxis range={[40, 40]} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={TOOLTIP_STYLE}
              content={({ payload }) => {
                if (!payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div style={TOOLTIP_STYLE}>
                    {d.name && <div style={{ color: T.purpleSoft, fontWeight: 700, marginBottom: 4 }}>{d.name}</div>}
                    <div style={{ color: T.textMuted, fontSize: '0.8rem' }}>x: {displayValue(d.x, fmt)}</div>
                    <div style={{ color: T.textMuted, fontSize: '0.8rem' }}>y: {displayValue(d.y, fmt)}</div>
                  </div>
                );
              }}
            />
            <Scatter data={data} fill={T.purpleHi} fillOpacity={0.8} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </ChartWrapper>
  );
}

// ─── Radar ────────────────────────────────────────────────────────────────────

function RadarComponent({ component }) {
  const { title, subtitle, data } = component;
  return (
    <ChartWrapper title={title} data={data} sql={component.sql} sources={component.sources}>
      <div style={{ marginTop: '1rem' }}>
        <ChartHeader title={title} subtitle={subtitle} />
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={data} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
            <PolarGrid stroke={T.border} />
            <PolarAngleAxis dataKey="name" tick={{ fill: T.textMuted, fontSize: 11 }} />
            <PolarRadiusAxis tick={{ fill: T.textDim, fontSize: 10 }} axisLine={false} />
            <Radar dataKey="value" stroke={T.purpleHi} fill={T.purpleHi} fillOpacity={0.25} strokeWidth={2} dot={{ r: 3, fill: T.purpleHi }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: T.purpleSoft }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </ChartWrapper>
  );
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────

function HeatmapComponent({ component }) {
  const { title, subtitle, data, sql, sources } = component;
  const ref = useRef(null);
  const [showCite, setShowCite] = useState(false);
  if (!data?.length) return null;
  const xs = [...new Set(data.map(d => d.x))];
  const ys = [...new Set(data.map(d => d.y))];
  const vals = data.map(d => d.value);
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const cell = data.reduce((m, d) => { m[`${d.x}||${d.y}`] = d.value; return m; }, {});
  const alpha = (v) => 0.08 + 0.82 * (v - minV) / (maxV - minV || 1);
  return (
    <div ref={ref} style={{ marginTop: '1rem' }}>
      {showCite && <DataCitationModal title={title} data={data} sql={sql} sources={sources} onClose={() => setShowCite(false)} />}
      <ChartHeader title={title} subtitle={subtitle} />
      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 3, fontSize: '0.72rem' }}>
          <thead>
            <tr>
              <td style={{ minWidth: 64 }} />
              {xs.map(x => <th key={x} style={{ color: T.textDim, padding: '2px 6px', textAlign: 'center', fontWeight: 600, whiteSpace: 'nowrap' }}>{x}</th>)}
            </tr>
          </thead>
          <tbody>
            {ys.map(y => (
              <tr key={y}>
                <td style={{ color: T.textDim, paddingRight: 8, whiteSpace: 'nowrap', fontWeight: 600 }}>{y}</td>
                {xs.map(x => {
                  const v = cell[`${x}||${y}`];
                  const bg = v != null ? `rgba(147,51,234,${alpha(v).toFixed(2)})` : T.surface;
                  return (
                    <td key={x} title={v != null ? `${x} × ${y}: ${v}` : '—'}
                        style={{ width: 44, height: 32, background: bg, borderRadius: 5, textAlign: 'center', color: alpha(v ?? 0) > 0.5 ? '#e9d5ff' : T.textDim, cursor: 'default' }}>
                      {v != null ? (v > 999 ? `${(v/1000).toFixed(1)}k` : v) : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.68rem', color: T.textDim }}>
          <span>low</span>
          <div style={{ width: 80, height: 8, borderRadius: 4, background: 'linear-gradient(to right, rgba(147,51,234,0.08), rgba(147,51,234,0.9))' }} />
          <span>high</span>
        </div>
        <ChartToolbar containerRef={ref} title={title} data={data} sql={sql} sources={sources} />
      </div>
    </div>
  );
}

// ─── Candlestick ──────────────────────────────────────────────────────────────

function CandlestickComponent({ component }) {
  const { title, subtitle, data } = component;
  if (!data?.length) return null;
  const W = 600, H = 280;
  const mg = { top: 20, right: 20, bottom: 36, left: 52 };
  const iW = W - mg.left - mg.right;
  const iH = H - mg.top - mg.bottom;

  const allV = data.flatMap(d => [d.high, d.low]);
  const minV = Math.min(...allV), maxV = Math.max(...allV);
  const pad  = (maxV - minV) * 0.08;
  const lo = minV - pad, hi = maxV + pad;
  const sy  = v => iH - ((v - lo) / (hi - lo)) * iH;

  const xStep = iW / data.length;
  const bw    = Math.max(4, Math.min(16, xStep * 0.55));
  const cx    = i => i * xStep + xStep / 2;

  const yTicks = Array.from({ length: 5 }, (_, i) => lo + (hi - lo) * i / 4);

  return (
    <ChartWrapper title={title} data={data} sql={component.sql} sources={component.sources}>
      <div style={{ marginTop: '1rem' }}>
        <ChartHeader title={title} subtitle={subtitle} />
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          <g transform={`translate(${mg.left},${mg.top})`}>
            {yTicks.map((v, i) => (
              <g key={i}>
                <line x1={0} y1={sy(v)} x2={iW} y2={sy(v)} stroke={T.border} strokeDasharray="3 3" />
                <text x={-6} y={sy(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill={T.textDim}>{v.toFixed(1)}</text>
              </g>
            ))}
            {data.map((d, i) => {
              const bull   = d.close >= d.open;
              const color  = bull ? '#10b981' : '#ef4444';
              const bodyT  = sy(Math.max(d.open, d.close));
              const bodyB  = sy(Math.min(d.open, d.close));
              const bodyH  = Math.max(1, bodyB - bodyT);
              const x      = cx(i);
              return (
                <g key={i}>
                  <line x1={x} y1={sy(d.high)} x2={x} y2={sy(d.low)} stroke={color} strokeWidth={1.5} />
                  <rect x={x - bw / 2} y={bodyT} width={bw} height={bodyH}
                        fill={bull ? color : color} stroke={color} strokeWidth={1} rx={2} />
                  <text x={x} y={iH + 20} textAnchor="middle" fontSize={9} fill={T.textDim}
                        transform={data.length > 10 ? `rotate(-35,${x},${iH + 20})` : undefined}>
                    {String(d.name).slice(0, 10)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 4, fontSize: '0.72rem', color: T.textDim }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: '#10b981', borderRadius: 2, display: 'inline-block' }} />Bullish</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: '#ef4444', borderRadius: 2, display: 'inline-block' }} />Bearish</span>
        </div>
      </div>
    </ChartWrapper>
  );
}

// ─── Explanation accordion ────────────────────────────────────────────────────

function CritiqueBadge({ critique }) {
  const [open, setOpen] = useState(false);
  if (!critique || !critique.verdict) return null;

  const palette = {
    ok:       { bg: '#0a3622', border: '#10b981', fg: '#86efac', icon: '✓', label: 'LLM-As-Judge Review Passed!' },
    minor:    { bg: '#3b2e0a', border: '#f59e0b', fg: '#fcd34d', icon: '!', label: 'Reviewed — minor note' },
    critical: { bg: '#450a0a', border: '#ef4444', fg: '#fca5a5', icon: '⚠', label: 'Reviewed — needs attention' },
  }[critique.verdict] || null;
  if (!palette) return null;

  const issueCount = critique.issues?.length ?? 0;
  const hasDetail  = issueCount > 0 || !!critique.suggestion || !!critique.summary;
  const isOk       = critique.verdict === 'ok';

  // OK state → compact icon-only chip with tooltip; click expands to show why.
  if (isOk) {
    return (
      <div style={{ marginTop: 10 }}>
        <button
          type="button"
          onClick={() => hasDetail && setOpen(v => !v)}
          title={palette.label}
          aria-label={palette.label}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 26, height: 26, borderRadius: 999,
            border: `1px solid ${palette.border}55`, background: palette.bg,
            color: palette.fg, fontWeight: 800, fontSize: '0.8rem',
            cursor: hasDetail ? 'pointer' : 'default', transition: 'all 0.15s',
          }}
          onMouseOver={e => { e.currentTarget.style.borderColor = palette.border; }}
          onMouseOut={e =>  { e.currentTarget.style.borderColor = `${palette.border}55`; }}
        >
          {palette.icon}
        </button>
        {open && hasDetail && (
          <div style={{ marginTop: 6, borderRadius: 10, border: `1px solid ${palette.border}55`, background: palette.bg, padding: '8px 11px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: palette.fg }}>{palette.label}</span>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: palette.fg, opacity: 0.7, display: 'flex' }}>
                <X size={13} />
              </button>
            </div>
            {critique.summary && (
              <div style={{ marginTop: 6, fontSize: '0.76rem', color: palette.fg, lineHeight: 1.5 }}>
                {critique.summary}
              </div>
            )}
            {critique.model && (
              <div style={{ marginTop: 6, fontSize: '0.66rem', color: palette.fg, opacity: 0.55 }}>
                Reviewed by {critique.model}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Minor / critical — full-width row, expandable to show issues + suggestion.
  return (
    <div style={{ marginTop: 10, borderRadius: 10, border: `1px solid ${palette.border}55`, background: palette.bg, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => hasDetail && setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 11px', background: 'transparent', border: 'none',
          color: palette.fg, fontSize: '0.78rem', fontWeight: 600,
          cursor: hasDetail ? 'pointer' : 'default', textAlign: 'left',
        }}
      >
        <span style={{ width: 18, height: 18, borderRadius: 999, background: `${palette.border}40`, color: palette.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, flexShrink: 0 }}>
          {palette.icon}
        </span>
        <span style={{ flex: 1 }}>{palette.label}{issueCount > 0 ? ` · ${issueCount} issue${issueCount === 1 ? '' : 's'}` : ''}</span>
        {hasDetail && (
          <ChevronDown size={13} style={{ color: palette.fg, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} />
        )}
      </button>
      {open && hasDetail && (
        <div style={{ padding: '0 11px 10px', borderTop: `1px solid ${palette.border}30` }}>
          {critique.summary && (
            <div style={{ marginTop: 8, fontSize: '0.76rem', color: palette.fg, lineHeight: 1.5 }}>
              {critique.summary}
            </div>
          )}
          {issueCount > 0 && (
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: palette.fg, fontSize: '0.76rem', lineHeight: 1.55 }}>
              {critique.issues.map((it, i) => <li key={i}>{it}</li>)}
            </ul>
          )}
          {critique.suggestion && (
            <div style={{ marginTop: 8, fontSize: '0.74rem', color: palette.fg, fontStyle: 'italic' }}>
              <strong style={{ fontStyle: 'normal' }}>Suggestion:</strong> {critique.suggestion}
            </div>
          )}
          {critique.model && (
            <div style={{ marginTop: 6, fontSize: '0.66rem', color: palette.fg, opacity: 0.55 }}>
              Reviewed by {critique.model}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ExplanationAccordion({ type, explanation }) {
  const [open, setOpen] = useState(false);
  const label = `Why ${type} chart?`;
  return (
    <div style={{ marginTop: 6 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'none', border: 'none', cursor: 'pointer',
          color: T.textDim, fontSize: '0.74rem', padding: '2px 0',
          transition: 'color 0.15s',
        }}
        onMouseOver={e => e.currentTarget.style.color = T.purpleSoft}
        onMouseOut={e => e.currentTarget.style.color = T.textDim}
      >
        <ChevronDown size={13} style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }} />
        {label}
      </button>
      {open && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 5, padding: '0.5rem 0.75rem', borderRadius: 8, background: `${T.purple}0e`, border: `1px solid ${T.purple}28` }}>
          <Sparkles size={11} color={T.purpleSoft} style={{ marginTop: 2, flexShrink: 0 }} />
          <span style={{ fontSize: '0.76rem', color: T.textDim, fontStyle: 'italic', lineHeight: 1.5 }}>{explanation}</span>
        </div>
      )}
    </div>
  );
}

// ─── Dispatcher + grouper ─────────────────────────────────────────────────────

function ChartComponent({ component }) {
  const inner = (() => {
    switch (component.type) {
      case 'kpi':          return <KpiCard component={component} />;
      case 'pie':          return <PieComponent component={component} />;
      case 'bar':          return <BarComponent component={component} />;
      case 'line':         return <LineComponent component={component} />;
      case 'area':         return <AreaComponent component={component} />;
      case 'table':        return <TableComponent component={component} />;
      case 'scatter':      return <ScatterComponent component={component} />;
      case 'radar':        return <RadarComponent component={component} />;
      case 'heatmap':      return <HeatmapComponent component={component} />;
      case 'candlestick':  return <CandlestickComponent component={component} />;
      default:             return null;
    }
  })();
  return (
    <div>
      {inner}
      {component.type !== 'kpi' && component.explanation && (
        <ExplanationAccordion type={component.type} explanation={component.explanation} />
      )}
    </div>
  );
}

function DashboardComponents({ components }) {
  if (!components?.length) return null;
  const groups = [];
  let kpiRun = [];
  for (const c of components) {
    if (c.type === 'kpi') { kpiRun.push(c); }
    else { if (kpiRun.length) { groups.push({ kind: 'kpi-row', items: kpiRun }); kpiRun = []; } groups.push({ kind: 'single', item: c }); }
  }
  if (kpiRun.length) groups.push({ kind: 'kpi-row', items: kpiRun });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {groups.map((g, i) =>
        g.kind === 'kpi-row'
          ? <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>{g.items.map((c, j) => <KpiCard key={j} component={c} />)}</div>
          : <ChartComponent key={i} component={g.item} />
      )}
    </div>
  );
}

// ─── Datasource UI ───────────────────────────────────────────────────────────

const DS_TYPE_COLOR = {
  duckdb: '#7C3AED', csv: '#10b981', json: '#10b981', jsonl: '#10b981',
  postgres: '#3b82f6', sqlite: '#f59e0b',
};

function DsTypeBadge({ type }) {
  const label = { duckdb: 'DuckDB', csv: 'CSV', json: 'JSON', jsonl: 'JSONL', postgres: 'PostgreSQL', sqlite: 'SQLite' }[type] ?? type;
  return (
    <span style={{
      fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: 6,
      background: `${DS_TYPE_COLOR[type] ?? '#71717a'}28`, color: DS_TYPE_COLOR[type] ?? '#71717a',
      textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>{label}</span>
  );
}

function DataSourceModal({ datasources, activeDsId, onSwitch, onDelete, onClose, onRefresh, t }) {
  const m = t.modal;
  const [tab,    setTab]    = useState('list');
  const [busy,   setBusy]   = useState(false);
  const [error,  setError]  = useState('');
  const [pgForm, setPgForm] = useState({ host: '', port: '5432', database: '', user: '', password: '', tables: '', display_name: '' });
  const fileInputRef   = useRef(null);
  const sqliteInputRef = useRef(null);
  const resetError = () => setError('');

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'json', 'jsonl'].includes(ext)) { setError('Only .csv, .json, and .jsonl files are supported.'); return; }
    setBusy(true); setError('');
    const form = new FormData();
    form.append('file', file);
    form.append('display_name', file.name.replace(/\.[^.]+$/, ''));
    try {
      const res = await fetch('http://localhost:8000/api/datasource/upload', { method: 'POST', body: form, credentials: 'include' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Upload failed'); }
      await onRefresh(); setTab('list');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); e.target.value = ''; }
  };

  const handlePgConnect = async () => {
    const tables = pgForm.tables.split(',').map(t => t.trim()).filter(Boolean);
    if (!pgForm.host || !pgForm.database || !pgForm.user || !tables.length) { setError('Fill in host, database, user, and at least one table name.'); return; }
    setBusy(true); setError('');
    try {
      const res = await fetch('http://localhost:8000/api/datasource/connect/postgres', { credentials: 'include',
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...pgForm, port: parseInt(pgForm.port, 10), tables }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Connection failed'); }
      await onRefresh(); setTab('list');
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
      const res = await fetch('http://localhost:8000/api/datasource/connect/sqlite', { method: 'POST', body: form, credentials: 'include' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Import failed'); }
      await onRefresh(); setTab('list');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); e.target.value = ''; }
  };

  const inputStyle = { width: '100%', padding: '0.55rem 0.8rem', borderRadius: 8, fontSize: '0.85rem', background: T.bg, border: `1px solid ${T.border2}`, color: T.textPri, outline: 'none', boxSizing: 'border-box' };
  const labelStyle = { fontSize: '0.72rem', color: T.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 };
  const primaryBtn = (d) => ({ padding: '0.55rem 1.1rem', borderRadius: 8, border: 'none', cursor: d ? 'not-allowed' : 'pointer', background: d ? T.border2 : T.purple, color: 'white', fontSize: '0.85rem', fontWeight: 600, opacity: d ? 0.6 : 1, transition: 'all 0.2s' });

  const tabs = [
    { key: 'list',     label: m.mySources,  Icon: Database },
    { key: 'upload',   label: m.uploadFile, Icon: Upload   },
    { key: 'postgres', label: m.postgres,   Icon: Link     },
    { key: 'sqlite',   label: m.sqlite,     Icon: Database },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
         onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 560, maxHeight: '85vh', borderRadius: 16, overflow: 'hidden', background: T.surface, border: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '1rem', color: T.textPri, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={18} color={T.purpleHi} /> {m.title}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer', lineHeight: 0 }}><X size={20} /></button>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, background: T.bg, padding: '0 0.5rem' }}>
          {tabs.map(({ key, label, Icon }) => (
            <button key={key} onClick={() => { setTab(key); resetError(); }} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '0.7rem 0.9rem',
              border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
              color: tab === key ? T.purpleHi : T.textDim,
              borderBottom: tab === key ? `2px solid ${T.purpleHi}` : '2px solid transparent', transition: 'all 0.15s',
            }}><Icon size={13} /> {label}</button>
          ))}
        </div>
        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
          {error && <div style={{ marginBottom: '1rem', padding: '0.65rem 0.9rem', borderRadius: 8, background: '#ef444418', border: '1px solid #ef4444', color: '#fca5a5', fontSize: '0.82rem' }}>{error}</div>}

          {tab === 'list' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {datasources.map(ds => (
                <div key={ds.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.75rem 1rem', borderRadius: 10, border: `1px solid ${ds.id === activeDsId ? T.purple : T.border}`, background: ds.id === activeDsId ? `${T.purple}10` : T.bg, cursor: 'pointer', transition: 'all 0.15s' }}
                     onClick={() => { onSwitch(ds.id); onClose(); }}>
                  <Database size={16} color={DS_TYPE_COLOR[ds.type] ?? T.textDim} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                      <span style={{ fontWeight: 600, fontSize: '0.88rem', color: T.textPri, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ds.name}</span>
                      <DsTypeBadge type={ds.type} />
                      {ds.id === activeDsId && <span style={{ fontSize: '0.62rem', color: T.purpleHi, fontWeight: 700 }}>{t.active}</span>}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: T.textDim }}>{ds.description}</span>
                  </div>
                  {!ds.is_default && (
                    <button onClick={e => { e.stopPropagation(); onDelete(ds.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textDim, lineHeight: 0, padding: 4, borderRadius: 6, transition: 'color 0.15s' }}
                            onMouseOver={e => e.currentTarget.style.color = '#ef4444'} onMouseOut={e => e.currentTarget.style.color = T.textDim}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
              {datasources.length === 1 && <p style={{ textAlign: 'center', color: T.textDim, fontSize: '0.82rem', paddingTop: '0.5rem' }}>{t.noCustomSources}</p>}
            </div>
          )}

          {tab === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ color: T.textMuted, fontSize: '0.85rem', margin: 0 }}>{m.uploadDesc}</p>
              <div onClick={() => fileInputRef.current?.click()} style={{ border: `2px dashed ${T.border2}`, borderRadius: 12, padding: '2.5rem 1rem', textAlign: 'center', cursor: 'pointer', color: T.textDim, fontSize: '0.88rem', transition: 'all 0.2s' }}
                   onMouseOver={e => { e.currentTarget.style.borderColor = T.purple; e.currentTarget.style.color = T.purpleSoft; }} onMouseOut={e => { e.currentTarget.style.borderColor = T.border2; e.currentTarget.style.color = T.textDim; }}>
                <Upload size={28} style={{ margin: '0 auto 0.6rem' }} />
                <div>{m.clickFile}</div>
                <div style={{ fontSize: '0.72rem', marginTop: 4 }}>{m.fileTypes}</div>
              </div>
              <input ref={fileInputRef} type="file" accept=".csv,.json,.jsonl" style={{ display: 'none' }} onChange={handleFileUpload} />
              {busy && <div style={{ textAlign: 'center', color: T.textMuted, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Loader2 size={14} className="animate-spin" /> {m.importing}</div>}
            </div>
          )}

          {tab === 'postgres' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <p style={{ color: T.textMuted, fontSize: '0.85rem', margin: 0 }}>{m.pgDesc}</p>
              {m.pgFields.map(([label, key, type, ph]) => (
                <div key={key}>
                  <label style={labelStyle}>{label}</label>
                  <input type={type} placeholder={ph} value={pgForm[key]} onChange={e => setPgForm(f => ({ ...f, [key]: e.target.value }))} style={inputStyle} />
                </div>
              ))}
              <button onClick={handlePgConnect} disabled={busy} style={primaryBtn(busy)}>{busy ? m.connectingBtn : m.connectBtn}</button>
            </div>
          )}

          {tab === 'sqlite' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ color: T.textMuted, fontSize: '0.85rem', margin: 0 }}>{m.sqliteDesc}</p>
              <div onClick={() => sqliteInputRef.current?.click()} style={{ border: `2px dashed ${T.border2}`, borderRadius: 12, padding: '2.5rem 1rem', textAlign: 'center', cursor: 'pointer', color: T.textDim, fontSize: '0.88rem', transition: 'all 0.2s' }}
                   onMouseOver={e => { e.currentTarget.style.borderColor = T.purple; e.currentTarget.style.color = T.purpleSoft; }} onMouseOut={e => { e.currentTarget.style.borderColor = T.border2; e.currentTarget.style.color = T.textDim; }}>
                <Database size={28} style={{ margin: '0 auto 0.6rem' }} />
                <div>{m.clickSqlite}</div>
                <div style={{ fontSize: '0.72rem', marginTop: 4 }}>{m.sqliteTypes}</div>
              </div>
              <input ref={sqliteInputRef} type="file" accept=".db,.sqlite" style={{ display: 'none' }} onChange={handleSqliteUpload} />
              {busy && <div style={{ textAlign: 'center', color: T.textMuted, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Loader2 size={14} className="animate-spin" /> {m.importingDb}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Welcome screen ───────────────────────────────────────────────────────────

function WelcomeScreen({ t, onSend, user }) {
  const base = t.greeting(new Date().getHours());
  const firstName = user?.name?.trim().split(' ')[0];
  const greeting = firstName ? `${base}, ${firstName}` : base;
  const icons = ['📊', '💬', '📈', '🤖', '📉'];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 2rem', gap: '2.5rem' }}>
      {/* Greeting */}
      <div style={{ textAlign: 'center' }}>
        <h2 style={{
          margin: 0, fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 700,
          background: `linear-gradient(135deg, ${T.purpleSoft}, ${T.purpleHi})`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          letterSpacing: '-0.02em',
        }}>
          {greeting}
        </h2>
        <p style={{ margin: '0.6rem 0 0', color: T.textMuted, fontSize: '1rem' }}>
          {t.welcomeSub}
        </p>
      </div>

      {/* Suggestion cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '0.75rem',
        width: '100%',
        maxWidth: 700,
      }}>
        {t.suggestions.map((q, i) => (
          <button
            key={i}
            onClick={() => onSend(q)}
            style={{
              textAlign: 'left',
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 14,
              padding: '1rem 1.1rem',
              cursor: 'pointer',
              color: T.textPri,
              fontSize: '0.88rem',
              lineHeight: 1.45,
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
            }}
            onMouseOver={e => {
              e.currentTarget.style.borderColor = T.purple;
              e.currentTarget.style.background = `${T.purple}12`;
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.borderColor = T.border;
              e.currentTarget.style.background = T.surface;
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <span style={{ fontSize: '1.1rem', lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{icons[i]}</span>
            <span>{q}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

const TEST_COMPONENTS = [
  {
    type: 'kpi', title: 'Containment Rate', subtitle: 'This week',
    data: [{ name: 'Containment Rate', value: 0.762 }],
    format: { unit: '%', scale: 100, decimals: 1, thresholds: { good: 0.85, direction: 'higher_is_better', good_color: '#7C3AED', warn_color: '#F59E0B' } },
  },
  {
    type: 'bar', title: 'Calls by Region', subtitle: 'All conversations',
    data: [
      { name: 'attica', value: 5007 }, { name: 'thessaloniki', value: 2156 },
      { name: 'crete', value: 1204 }, { name: 'patras', value: 876 },
      { name: 'larissa', value: 543 }, { name: 'other_gr', value: 214 },
    ],
    format: { unit: '', scale: 1, decimals: 0, thresholds: null },
  },
];

function panelLabel(components) {
  if (!components?.length) return '';
  if (components.length === 1) { const t = components[0].type; return `View ${t.charAt(0).toUpperCase() + t.slice(1)} Chart`; }
  return `View Dashboard (${components.length} charts)`;
}

// ─── Initial realistic chat history (uses actual dataset values) ──────────────

const WELCOME_CHAT_ID = 'chat-welcome';
const WELCOME_CHAT    = { id: WELCOME_CHAT_ID, title: 'New Chat', messages: [], sessionId: null, activeIndex: null };

function storageKey(email, suffix) {
  return `uniai_${suffix}_${email}`;
}

function loadFromStorage(email) {
  try {
    const chats     = JSON.parse(localStorage.getItem(storageKey(email, 'chats'))     ?? 'null');
    const chatOrder = JSON.parse(localStorage.getItem(storageKey(email, 'chatOrder')) ?? 'null');
    if (chats && chatOrder) return { chats, chatOrder };
  } catch {}
  return null;
}

// ─── UserMenu ─────────────────────────────────────────────────────────────────

function UserMenu({ user, onLogout, T }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const initials = user.name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Your profile"
        style={{
          width: 34, height: 34, borderRadius: '50%', border: `2px solid ${open ? '#9333ea' : '#3f3f46'}`,
          background: 'linear-gradient(135deg, #7e22ce, #9333ea)',
          color: '#fff', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'border-color 0.2s',
          flexShrink: 0,
        }}
      >
        {initials}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 10px)', right: 0, zIndex: 200,
          width: 240, borderRadius: 16,
          background: '#18181b', border: '1px solid #3f3f46',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}>
          {/* Profile header */}
          <div style={{ padding: '1.1rem 1.1rem 0.85rem', borderBottom: '1px solid #27272a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #7e22ce, #9333ea)',
                color: '#fff', fontWeight: 700, fontSize: '1rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {initials}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: '#e4e4e7', fontWeight: 700, fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.name}
                </div>
                <div style={{ color: '#71717a', fontSize: '0.76rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                  {user.email}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ padding: '0.5rem' }}>
            <button
              onClick={() => { setOpen(false); onLogout(); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem',
                padding: '0.6rem 0.75rem', borderRadius: 10, border: 'none',
                background: 'transparent', color: '#fca5a5', cursor: 'pointer',
                fontSize: '0.85rem', fontWeight: 600, textAlign: 'left',
                transition: 'background 0.15s',
              }}
              onMouseOver={e => e.currentTarget.style.background = '#450a0a'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >
              <LogOut size={15} /> Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App({ user, onLogout }) {
  // ── Locale ──
  const [locale, setLocale] = useState('en');
  const t = I18N[locale];

  // ── Chat registry — persisted in localStorage, namespaced per user ──
  const [chats, setChats] = useState(() => {
    const saved = loadFromStorage(user.email);
    return saved?.chats ?? { [WELCOME_CHAT_ID]: WELCOME_CHAT };
  });
  const [chatOrder, setChatOrder] = useState(() => {
    const saved = loadFromStorage(user.email);
    return saved?.chatOrder ?? [WELCOME_CHAT_ID];
  });
  const [activeChatId, setActiveChatId] = useState(() => {
    const saved = loadFromStorage(user.email);
    return saved?.chatOrder?.[0] ?? WELCOME_CHAT_ID;
  });

  // Derived from active chat
  const chat           = chats[activeChatId] ?? { messages: [], sessionId: null, activeIndex: null };
  const messages       = chat.messages;
  const sessionId      = chat.sessionId;
  const activeIndex    = chat.activeIndex;
  const activeComponents = activeIndex !== null ? messages[activeIndex]?.components : null;

  // Welcome screen: active chat has no user messages
  const isWelcomeScreen = !messages.some(m => m.role === 'user');

  // ── Input / loading (transient — not persisted per chat) ──
  const [input,          setInput]          = useState('');
  const [isLoading,      setIsLoading]      = useState(false);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [currentStep,    setCurrentStep]    = useState('');

  // ── Datasources ──
  const [datasources,    setDatasources]    = useState([]);
  const [activeDsId,     setActiveDsId]     = useState('default');
  const [showDsModal,    setShowDsModal]    = useState(false);
  const [userLevel,      setUserLevel]      = useState('auto');

  // ── Sidebar ──
  const [isSidebarOpen,  setIsSidebarOpen]  = useState(true);

  // ── Resizable panel ──
  const [panelWidth,     setPanelWidth]     = useState(480);
  const [isDragging,     setIsDragging]     = useState(false);

  const currentStepRef = useRef('');
  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  // ── Helper: update a single chat by id ──
  const updateChat = (id, patch) =>
    setChats(prev => ({ ...prev, [id]: { ...prev[id], ...(typeof patch === 'function' ? patch(prev[id]) : patch) } }));

  // Panel drag-to-resize
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const w = document.body.clientWidth - e.clientX;
      if (w > 300 && w < 900) setPanelWidth(w);
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
    return () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); };
  }, [isDragging]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const fetchDatasources = async () => {
    try { const res = await fetch('http://localhost:8000/api/datasource', { credentials: 'include' }); if (res.ok) setDatasources(await res.json()); } catch { }
  };
  useEffect(() => { fetchDatasources(); }, []);

  // ── Persist chat history to localStorage, namespaced per user ──
  useEffect(() => {
    try {
      localStorage.setItem(storageKey(user.email, 'chats'),     JSON.stringify(chats));
      localStorage.setItem(storageKey(user.email, 'chatOrder'), JSON.stringify(chatOrder));
    } catch {}
  }, [chats, chatOrder, user.email]);

  // ── New chat ──
  const handleNewChat = () => {
    // If the active chat is already blank (welcome screen), just stay on it
    const cur = chats[activeChatId];
    if (cur && !cur.messages.some(m => m.role === 'user')) {
      setInput(''); return;
    }
    const id = `chat-${Date.now()}`;
    setChats(prev => ({ ...prev, [id]: { id, title: t.newChat, messages: [], sessionId: null, activeIndex: null } }));
    setChatOrder(prev => [id, ...prev]);
    setActiveChatId(id);
    setInput('');
    setIsLoading(false);
    setCompletedSteps([]);
    setCurrentStep('');
    currentStepRef.current = '';
  };

  // ── Switch chat ──
  const handleSwitchChat = (id) => {
    if (id === activeChatId) return;
    setActiveChatId(id);
    setIsLoading(false);
    setCompletedSteps([]);
    setCurrentStep('');
    currentStepRef.current = '';
    setInput('');
  };

  const handleDeleteDs = async (dsId) => {
    try { await fetch(`http://localhost:8000/api/datasource/${dsId}`, { method: 'DELETE', credentials: 'include' }); if (activeDsId === dsId) setActiveDsId('default'); await fetchDatasources(); } catch { }
  };

  const handleSwitchDs = async (newId) => {
    if (newId === activeDsId) return;
    const ds = datasources.find(d => d.id === newId);
    if (sessionId) { try { await fetch(`http://localhost:8000/api/session/reset?session_id=${sessionId}`, { method: 'POST', credentials: 'include' }); } catch { } }
    setActiveDsId(newId);
    if (ds) updateChat(activeChatId, c => ({ ...c, messages: [...c.messages, { role: 'separator', dsName: ds.name, dsType: ds.type }] }));
  };

  const runTestMode = () => {
    const chatId = activeChatId;
    const reply  = 'Here is a mock dashboard. I have opened the Data Inspector on the right.';
    updateChat(chatId, c => {
      const next = [...c.messages, { role: 'user', text: '(Test Mode) Show me a quick overview.', components: null }, { role: 'assistant', text: reply, components: TEST_COMPONENTS }];
      return { ...c, messages: next, activeIndex: next.length - 1 };
    });
  };

  // ── Core send — shared by form submit and welcome card clicks ──
  const sendMessage = async (text) => {
    if (!text.trim() || isLoading) return;

    const chatId    = activeChatId;   // snapshot so async closures target the right chat
    const curChat   = chats[chatId];
    const snapDs    = datasources.find(d => d.id === activeDsId);
    const curSessId = curChat?.sessionId ?? null;

    // Auto-title from the very first user message in this chat
    const isFirstMsg = !(curChat?.messages ?? []).some(m => m.role === 'user');
    const autoTitle  = isFirstMsg ? (text.length > 42 ? text.slice(0, 42) + '…' : text) : null;

    setInput('');
    updateChat(chatId, c => ({
      ...c,
      messages: [...(c.messages ?? []), { role: 'user', text, components: null }],
      ...(autoTitle ? { title: autoTitle } : {}),
    }));

    setIsLoading(true);
    setCompletedSteps([]);
    setCurrentStep('');
    currentStepRef.current = '';

    try {
      const response = await fetch('http://localhost:8000/api/chat/stream', { credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_id: curSessId, datasource_id: activeDsId, user_level: userLevel }),
      });
      if (!response.ok || !response.body) throw new Error(`Server error ${response.status}`);

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = '';

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
          let event; try { event = JSON.parse(raw); } catch { continue; }

          if (event.type === 'progress') {
            if (currentStepRef.current) { const d = currentStepRef.current; setCompletedSteps(s => [...s, d]); }
            currentStepRef.current = event.message;
            setCurrentStep(event.message);

          } else if (event.type === 'result') {
            const components   = event.components?.length ? event.components : null;
            const assistantMsg = { role: 'assistant', text: event.reply || 'Here is the data you requested.', components, suggestions: event.suggestions || [], dsName: snapDs?.name, dsType: snapDs?.type, critique: event._critique ?? null };
            updateChat(chatId, c => {
              const next = [...(c.messages ?? []), assistantMsg];
              return { ...c, messages: next, sessionId: event.session_id ?? c.sessionId, activeIndex: components ? next.length - 1 : c.activeIndex };
            });

          } else if (event.type === 'error') {
            updateChat(chatId, c => ({ ...c, messages: [...(c.messages ?? []), { role: 'assistant', text: `Something went wrong: ${event.message}`, components: null }] }));
          }
        }
      }
    } catch {
      updateChat(chatId, c => ({ ...c, messages: [...(c.messages ?? []), { role: 'assistant', text: "Oops! We couldn't reach the server. Please make sure the backend is running and try again.", components: null }] }));
    } finally {
      setIsLoading(false); setCompletedSteps([]); setCurrentStep(''); currentStepRef.current = '';
    }
  };

  const handleSend = (e) => { e.preventDefault(); sendMessage(input); };

  const activeDs = datasources.find(d => d.id === activeDsId);

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: T.bg, color: T.textPri, fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden' }}>

      {showDsModal && (
        <DataSourceModal datasources={datasources} activeDsId={activeDsId} onSwitch={handleSwitchDs} onDelete={handleDeleteDs} onClose={() => setShowDsModal(false)} onRefresh={fetchDatasources} t={t} />
      )}

      {/* ── LEFT SIDEBAR ── */}
      <div style={{ width: isSidebarOpen ? 260 : 0, flexShrink: 0, backgroundColor: '#000000', borderRight: isSidebarOpen ? `1px solid ${T.border}` : 'none', transition: 'width 0.3s ease', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 260, flex: 1 }}>
          <button onClick={handleNewChat}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: T.surface, color: T.textPri, padding: '0.75rem 1rem', borderRadius: 8, border: `1px solid ${T.border2}`, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, transition: 'all 0.2s', justifyContent: 'center' }}
                  onMouseOver={e => e.currentTarget.style.borderColor = T.purpleSoft} onMouseOut={e => e.currentTarget.style.borderColor = T.border2}>
            <Plus size={18} /> {t.newChat}
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '0.75rem', color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', paddingLeft: '0.5rem' }}>{t.chatHistory}</h3>
            {chatOrder.map(id => chats[id]).filter(Boolean).map(chat => (
              <button key={chat.id} onClick={() => handleSwitchChat(chat.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', backgroundColor: activeChatId === chat.id ? T.surface : 'transparent', border: 'none', borderRadius: 8, color: activeChatId === chat.id ? T.textPri : T.textMuted, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', width: '100%' }}>
                <MessageSquare size={16} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chat.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Header */}
        <header style={{ backgroundColor: T.bg, padding: '1.25rem 1.5rem', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    onMouseOver={e => e.currentTarget.style.color = T.textPri} onMouseOut={e => e.currentTarget.style.color = T.textMuted}>
              <Menu size={24} />
            </button>
            <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, color: T.purpleSoft, display: 'flex', alignItems: 'center' }}>
              {t.appTitle}
              <span style={{ fontSize: '0.62rem', color: '#bd69df', fontWeight: 400, marginLeft: '0.35rem', marginTop: '0.55rem', letterSpacing: '0.05em' }}>{' '}{t.appSubtitle}</span>
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Language toggle */}
            <button
              onClick={() => setLocale(l => l === 'en' ? 'el' : 'en')}
              title={locale === 'en' ? 'Switch to Greek' : 'Αλλαγή σε Αγγλικά'}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '0.4rem 0.75rem', borderRadius: 8, cursor: 'pointer',
                background: T.surface, border: `1px solid ${T.border2}`,
                color: T.textMuted, fontSize: '0.78rem', fontWeight: 600,
                letterSpacing: '0.04em', transition: 'all 0.2s',
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor = T.purple; e.currentTarget.style.color = T.purpleSoft; }}
              onMouseOut={e =>  { e.currentTarget.style.borderColor = T.border2; e.currentTarget.style.color = T.textMuted; }}
            >
              <ChevronRight size={12} style={{ transform: 'rotate(90deg)' }} />
              {locale === 'en' ? 'EN' : 'ΕΛ'}
            </button>

            {/* User level selector */}
            <button
              onClick={() => setUserLevel(l => l === 'auto' ? 'simple' : l === 'simple' ? 'expert' : 'auto')}
              title={userLevel === 'auto' ? 'Auto user level' : userLevel === 'simple' ? 'Simple user' : 'Expert user'}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0.4rem 0.8rem', borderRadius: 8, cursor: 'pointer', background: T.surface, border: `1px solid ${T.border2}`, color: T.textMuted, fontSize: '0.8rem', transition: 'all 0.2s', maxWidth: 200 }}
              onMouseOver={e => { e.currentTarget.style.borderColor = T.purple; e.currentTarget.style.color = T.purpleSoft; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = T.border2; e.currentTarget.style.color = T.textMuted; }}
            >
              <Sparkles size={13} color={userLevel === 'expert' ? T.purple : userLevel === 'simple' ? T.textDim : '#10b981'} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                {userLevel === 'auto' ? (locale === 'en' ? 'Auto' : 'Αυτόματο') : userLevel === 'simple' ? (locale === 'en' ? 'Simple' : 'Απλό') : (locale === 'en' ? 'Expert' : 'Ειδικό')}
              </span>
              <ChevronDown size={12} />
            </button>

            {/* Datasource selector */}
            {datasources.length > 0 && (() => {
              const active = datasources.find(d => d.id === activeDsId) ?? datasources[0];
              return (
                <button onClick={() => setShowDsModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0.4rem 0.8rem', borderRadius: 8, cursor: 'pointer', background: T.surface, border: `1px solid ${T.border2}`, color: T.textMuted, fontSize: '0.8rem', transition: 'all 0.2s', maxWidth: 200 }}
                        onMouseOver={e => { e.currentTarget.style.borderColor = T.purple; e.currentTarget.style.color = T.purpleSoft; }} onMouseOut={e => { e.currentTarget.style.borderColor = T.border2; e.currentTarget.style.color = T.textMuted; }}>
                  <Database size={13} color={DS_TYPE_COLOR[active.type] ?? T.textDim} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{active.name}</span>
                  <ChevronDown size={12} />
                </button>
              );
            })()}

            {/* Add datasource */}
            <button onClick={() => setShowDsModal(true)} title={t.addSource} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.4rem', borderRadius: 8, cursor: 'pointer', background: T.surface, border: `1px solid ${T.border2}`, color: T.textMuted, transition: 'all 0.2s' }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = T.purple; e.currentTarget.style.color = T.purpleSoft; }} onMouseOut={e => { e.currentTarget.style.borderColor = T.border2; e.currentTarget.style.color = T.textMuted; }}>
              <Plus size={16} />
            </button>

            <button onClick={runTestMode} style={{ backgroundColor: T.surface, color: T.purpleSoft, padding: '0.45rem 1rem', borderRadius: 8, border: `1px solid ${T.border2}`, cursor: 'pointer', fontSize: '0.88rem', fontWeight: 500, transition: 'all 0.2s' }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = T.purple; e.currentTarget.style.backgroundColor = T.border; }} onMouseOut={e => { e.currentTarget.style.borderColor = T.border2; e.currentTarget.style.backgroundColor = T.surface; }}>
              {t.testMode}
            </button>

            {user && <UserMenu user={user} onLogout={onLogout} T={T} />}
          </div>
        </header>

        {/* Active datasource banner */}
        {activeDs && !activeDs.is_default && (
          <div style={{ padding: '0.5rem 1.5rem', borderBottom: `1px solid ${T.border}`, background: `${DS_TYPE_COLOR[activeDs.type] ?? T.purple}12`, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem' }}>
            <Database size={12} color={DS_TYPE_COLOR[activeDs.type] ?? T.purpleHi} />
            <span style={{ color: T.textMuted }}>{t.querying} <strong style={{ color: T.textPri }}>{activeDs.name}</strong>{' '}·{' '}{activeDs.description}</span>
            <button onClick={() => setShowDsModal(true)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline' }}>{t.switchBtn}</button>
          </div>
        )}

        {/* Messages area — welcome screen or conversation */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {isWelcomeScreen ? (
            <WelcomeScreen t={t} onSend={sendMessage} user={user} />
          ) : (
            <div style={{ padding: '2rem' }}>
              <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {messages.map((msg, idx) => {
                  if (msg.role === 'separator') {
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, height: 1, background: T.border }} />
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', fontSize: '0.7rem', color: T.textDim, padding: '3px 10px', borderRadius: 20, border: `1px solid ${T.border}`, background: T.surface }}>
                          <Database size={10} color={DS_TYPE_COLOR[msg.dsType] ?? T.textDim} />
                          {t.nowQuerying} <strong style={{ color: T.textPri, fontWeight: 600, marginLeft: 4 }}>{msg.dsName}</strong>
                        </span>
                        <div style={{ flex: 1, height: 1, background: T.border }} />
                      </div>
                    );
                  }

                  return (
                    <div key={idx} style={{ display: 'flex', gap: '1rem', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                      {/* Avatar */}
                      <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: msg.role === 'user' ? T.purple : T.border, color: msg.role === 'user' ? 'white' : T.textMuted }}>
                        {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                      </div>

                      {/* Bubble */}
                      <div style={{ maxWidth: '85%', padding: '1.25rem', borderRadius: 16, backgroundColor: msg.role === 'user' ? T.userBg : T.surface, border: msg.role === 'user' ? 'none' : `1px solid ${T.border}`, borderTopRightRadius: msg.role === 'user' ? 4 : 16, borderTopLeftRadius: msg.role === 'assistant' ? 4 : 16 }}>
                        {msg.text && <p style={{ margin: 0, lineHeight: 1.6, fontSize: '1rem', color: msg.role === 'user' ? T.userText : T.textPri }}>{msg.text}</p>}

                        {msg.role === 'assistant' && msg.critique && <CritiqueBadge critique={msg.critique} />}

                        {/* Datasource badge */}
                        {msg.role === 'assistant' && msg.dsName && (
                          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Database size={10} color={DS_TYPE_COLOR[msg.dsType] ?? T.textDim} />
                            <span style={{ fontSize: '0.65rem', color: T.textDim }}>{msg.dsName}</span>
                          </div>
                        )}

                        {/* View Dashboard */}
                        {msg.components && activeIndex !== idx && (
                          <button onClick={() => updateChat(activeChatId, { activeIndex: idx })} style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.88rem', transition: 'all 0.2s', backgroundColor: T.border, border: `1px solid ${T.border2}`, color: T.purpleSoft }}
                                  onMouseOver={e => e.currentTarget.style.borderColor = T.purple} onMouseOut={e => e.currentTarget.style.borderColor = T.border2}>
                            <BarChart2 size={16} /> {panelLabel(msg.components)}
                          </button>
                        )}

                        {/* Suggestions */}
                        {msg.role === 'assistant' && msg.suggestions?.length > 0 && (
                          <div style={{ marginTop: '1.1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: '0.5rem' }}>
                              <Sparkles size={11} color={T.textDim} />
                              <span style={{ fontSize: '0.68rem', fontWeight: 600, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t.exploreFurther}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {msg.suggestions.map((q, i) => (
                                <button key={i} onClick={() => { setInput(q); inputRef.current?.focus(); }} style={{ textAlign: 'left', background: 'none', cursor: 'pointer', padding: '0.45rem 0.75rem', borderRadius: 8, border: `1px solid ${T.border2}`, color: T.textMuted, fontSize: '0.82rem', lineHeight: 1.4, transition: 'all 0.18s' }}
                                        onMouseOver={e => { e.currentTarget.style.borderColor = T.purple; e.currentTarget.style.color = T.purpleSoft; e.currentTarget.style.background = `${T.purple}14`; }} onMouseOut={e => { e.currentTarget.style.borderColor = T.border2; e.currentTarget.style.color = T.textMuted; e.currentTarget.style.background = 'none'; }}>
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
                    <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: T.border, color: T.textMuted }}>
                      <Bot size={20} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 10, borderLeft: `2px solid ${T.border2}`, paddingLeft: '1rem' }}>
                      {completedSteps.map((step, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, color: T.textDim, fontSize: '0.78rem' }}>
                          <Check size={12} color={T.purple} strokeWidth={3} /><span>{step}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: T.textMuted, fontSize: '0.82rem', fontWeight: 500 }}>
                        <Loader2 size={13} className="animate-spin" /><span>{currentStep || t.connecting}</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ backgroundColor: T.bg, padding: '1.25rem 1.5rem', borderTop: `1px solid ${T.border}` }}>
          <form onSubmit={handleSend} style={{ maxWidth: 800, margin: '0 auto', display: 'flex', gap: '0.75rem' }}>
            <button type="button" title={t.addSource} onClick={() => setShowDsModal(true)} style={{ backgroundColor: T.surface, color: T.textMuted, padding: '0 1.25rem', borderRadius: 12, border: `1px solid ${T.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}
                    onMouseOver={e => { e.currentTarget.style.color = T.purpleSoft; e.currentTarget.style.borderColor = T.purple; }} onMouseOut={e => { e.currentTarget.style.color = T.textMuted; e.currentTarget.style.borderColor = T.border; }}>
              <Paperclip size={20} />
            </button>
            <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)} placeholder={t.placeholder} disabled={isLoading}
                   style={{ flex: 1, padding: '1rem 1.25rem', borderRadius: 12, border: `1px solid ${T.border}`, backgroundColor: T.surface, color: '#f4f4f5', outline: 'none', fontSize: '1rem', transition: 'border-color 0.2s' }}
                   onFocus={e => e.target.style.borderColor = T.purple} onBlur={e => e.target.style.borderColor = T.border} />
            <button type="submit" disabled={isLoading || !input.trim()} style={{ backgroundColor: T.purple, color: 'white', padding: '0 1.5rem', borderRadius: 12, border: 'none', cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.2s', opacity: isLoading || !input.trim() ? 0.5 : 1 }}>
              <Send size={20} />
            </button>
          </form>
        </div>
      </div>

      {/* ── RIGHT: Resizable Data Inspector Panel ── */}
      {activeComponents && (
        <div style={{ width: panelWidth, borderLeft: `1px solid ${T.border}`, backgroundColor: T.bg, display: 'flex', flexDirection: 'column', position: 'relative', animation: 'slideIn 0.25s ease-out' }}>
          {/* Drag handle */}
          <div onMouseDown={() => setIsDragging(true)} style={{ position: 'absolute', left: -8, top: 0, bottom: 0, width: 16, cursor: 'col-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', zIndex: 10 }}>
            <div style={{ position: 'absolute', left: 7, top: 0, bottom: 0, width: 2, backgroundColor: isDragging ? T.purple : 'transparent', transition: 'background-color 0.2s' }} />
            <div style={{ backgroundColor: T.surface, border: `1px solid ${T.border}`, borderRadius: 4, padding: 2, zIndex: 11, color: isDragging ? T.purpleSoft : T.textDim, opacity: isDragging ? 1 : 0.8, transition: 'all 0.2s' }}>
              <GripVertical size={14} />
            </div>
          </div>

          {/* Panel header */}
          <div style={{ padding: '1rem 1.5rem', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 500, color: T.textPri, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart2 size={20} color={T.purpleHi} /> {t.dataInspector}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  const chatTitle = chats[activeChatId]?.title ?? 'Data Report';
                  const html = generateHtmlReport(activeComponents, chatTitle);
                  const win  = window.open('', '_blank');
                  win.document.write(html);
                  win.document.close();
                  win.focus();
                }}
                title="Download / Print report"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 6, border: `1px solid ${T.border}`, background: T.surface, color: T.textMuted, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 500, transition: 'all 0.15s' }}
                onMouseOver={e => { e.currentTarget.style.borderColor = T.purpleSoft; e.currentTarget.style.color = T.textPri; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMuted; }}>
                <Share2 size={14} /> Share
              </button>
              <button onClick={() => updateChat(activeChatId, { activeIndex: null })}
                      style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer', transition: 'color 0.2s', lineHeight: 0, padding: 4 }}
                      onMouseOver={e => e.currentTarget.style.color = T.textPri} onMouseOut={e => e.currentTarget.style.color = T.textMuted}>
                <X size={22} />
              </button>
            </div>
          </div>

          {/* Panel body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
            <DashboardComponents components={activeComponents} />
            {activeComponents.some(c => c.type !== 'table' && c.type !== 'kpi' && c.data) && (
              <div style={{ marginTop: '3rem', borderTop: `1px solid ${T.border}`, paddingTop: '1.5rem' }}>
                <h3 style={{ fontSize: '0.85rem', color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>{t.rawData}</h3>
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
