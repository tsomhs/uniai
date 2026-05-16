import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2, X, BarChart2, Paperclip } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

function App() {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hello! I am connected to your database. What would you like to know?', chart: null }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeChart, setActiveChart] = useState(null); 
  
  const messagesEndRef = useRef(null);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Test Mode Injection
  const runTestMode = () => {
    const mockData = {
      type: 'bar',
      data: [
        { name: 'Attica', value: 450 },
        { name: 'Thessaloniki', value: 280 },
        { name: 'Crete', value: 150 },
        { name: 'Patras', value: 90 },
      ]
    };
    
    setMessages(prev => [
      ...prev, 
      { role: 'user', text: '(Test Mode) Show me a bar chart of calls by region.' },
      { role: 'assistant', text: 'Here is the mock data you requested. I have opened the chart in the side panel.', chart: mockData }
    ]);
    setActiveChart(mockData); 
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage, components: null }]);
    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });
      const data = await response.json();
      const newChart = data.chartData ? { type: data.chartType, data: data.chartData } : null;
      
      setMessages((prev) => [...prev, { 
        role: 'assistant', 
        text: data.reply || "Here is the data you requested.",
        chart: newChart
      }]);

      if (newChart) setActiveChart(newChart);

    } catch (error) {
      console.error("Error communicating with backend:", error);
      setMessages((prev) => [...prev, { role: 'assistant', text: "Sorry, I couldn't connect to the backend server. Is FastAPI running?" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderChart = (chartInfo) => {
    if (!chartInfo || !chartInfo.data) return null;

    const COLORS = ['#a855f7', '#c084fc', '#d8b4fe', '#9333ea', '#7e22ce', '#6b21a8'];
    const axisColor = '#71717a'; 

    return (
      <ResponsiveContainer width="100%" height="100%">
        {chartInfo.type === 'pie' || chartInfo.type === 'donut' ? (
          <PieChart>
            <Tooltip 
              contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#f4f4f5', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)' }} 
              itemStyle={{ color: '#d8b4fe' }}
            />
            <Pie
              data={chartInfo.data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={120}
              innerRadius={chartInfo.type === 'donut' ? 80 : 0}
              fill="#a855f7"
              stroke="#09090b"
              strokeWidth={3}
            >
              {chartInfo.data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        ) : chartInfo.type === 'line' ? (
          <LineChart data={chartInfo.data} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" stroke={axisColor} tick={{ fill: axisColor, fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis stroke={axisColor} tick={{ fill: axisColor, fontSize: 12 }} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#f4f4f5' }} 
            />
            <Line type="monotone" dataKey="value" stroke="#a855f7" strokeWidth={4} dot={{ fill: '#a855f7', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, fill: '#d8b4fe' }} />
          </LineChart>
        ) : (
          <BarChart data={chartInfo.data} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" stroke={axisColor} tick={{ fill: axisColor, fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis stroke={axisColor} tick={{ fill: axisColor, fontSize: 12 }} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#f4f4f5' }} 
              cursor={{ fill: '#18181b' }}
            />
            <Bar dataKey="value" fill="#a855f7" radius={[6, 6, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    );
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#09090b', color: '#e4e4e7', fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden' }}>
      
      {/* LEFT SIDE: Chat Interface */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', transition: 'all 0.3s ease' }}>
        
        {/* Header */}
        <header style={{ backgroundColor: '#09090b', padding: '1.5rem', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', color: '#d8b4fe', display: 'flex', alignItems: 'center' }}>
            Speak With Your Data
            <span style={{ fontSize: '0.65rem', color: '#bd69df', fontWeight: '400', marginLeft: '0.35rem', marginTop: '0.6rem',  letterSpacing: '0.05em' }}> by Prompt Masters
	    </span>
          </h1>
          
          <button
            onClick={runTestMode}
            style={{ 
              backgroundColor: '#18181b', color: '#d8b4fe', padding: '0.5rem 1rem', borderRadius: '8px', 
              border: '1px solid #3f3f46', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500', transition: 'all 0.2s' 
            }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = '#9333ea'; e.currentTarget.style.backgroundColor = '#27272a'; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = '#3f3f46'; e.currentTarget.style.backgroundColor = '#18181b'; }}
          >
            Test Mode
          </button>
        </header>

        {/* Chat Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', width: '100%' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {messages.map((msg, index) => (
              <div key={index} style={{ display: 'flex', gap: '1rem', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                
                {/* Avatar */}
                <div style={{ flexShrink: 0, width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: msg.role === 'user' ? '#9333ea' : '#27272a', color: msg.role === 'user' ? 'white' : '#a1a1aa' }}>
                  {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                </div>

                {/* Message Bubble */}
                <div style={{ 
                  maxWidth: '85%', 
                  padding: '1.25rem', 
                  borderRadius: '16px', 
                  backgroundColor: msg.role === 'user' ? '#7e22ce' : '#18181b', 
                  border: msg.role === 'user' ? 'none' : '1px solid #27272a',
                  borderTopRightRadius: msg.role === 'user' ? '4px' : '16px',
                  borderTopLeftRadius: msg.role === 'assistant' ? '4px' : '16px',
                }}>
                  <p style={{ margin: 0, lineHeight: '1.6', fontSize: '1.05rem', color: msg.role === 'user' ? '#fdf4ff' : '#e4e4e7' }}>
                    {msg.text}
                  </p>
                  
                  {/* Chart Button - ONLY shows if chart exists AND it is not the currently active chart */}
                  {msg.chart && msg.chart !== activeChart && (
                    <button 
                      onClick={() => setActiveChart(msg.chart)}
                      style={{ 
                        marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', 
                        backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: '8px', 
                        color: '#d8b4fe', cursor: 'pointer', fontSize: '0.9rem', transition: 'all 0.2s' 
                      }}
                      onMouseOver={(e) => e.currentTarget.style.borderColor = '#9333ea'}
                      onMouseOut={(e) => e.currentTarget.style.borderColor = '#3f3f46'}
                    >
                      <BarChart2 size={18} /> View {msg.chart.type.charAt(0).toUpperCase() + msg.chart.type.slice(1)} Chart
                    </button>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#a1a1aa', paddingLeft: '4rem' }}>
                <Loader2 className="animate-spin" size={20} /> Analyzing data...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div style={{ backgroundColor: '#09090b', padding: '1.5rem', borderTop: '1px solid #27272a' }}>
          <form onSubmit={handleSend} style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', gap: '1rem' }}>
            
            {/* NEW: Upload Files Button */}
            <button
              type="button"
              title="Upload files"
              style={{ 
                backgroundColor: '#18181b', color: '#a1a1aa', padding: '0 1.25rem', borderRadius: '12px', 
                border: '1px solid #27272a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' 
              }}
              onMouseOver={(e) => { e.currentTarget.style.color = '#d8b4fe'; e.currentTarget.style.borderColor = '#9333ea'; }}
              onMouseOut={(e) => { e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.borderColor = '#27272a'; }}
            >
              <Paperclip size={20} />
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about your data..."
              style={{ flex: 1, padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid #27272a', backgroundColor: '#18181b', color: '#f4f4f5', outline: 'none', fontSize: '1.05rem', transition: 'border-color 0.2s' }}
              onFocus={(e) => e.target.style.borderColor = '#9333ea'}
              onBlur={(e) => e.target.style.borderColor = '#27272a'}
              disabled={isLoading}
            />
            
            <button 
              type="submit" 
              disabled={isLoading || !input.trim()}
              style={{ backgroundColor: '#9333ea', color: 'white', padding: '0 1.5rem', borderRadius: '12px', border: 'none', cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.2s', opacity: isLoading || !input.trim() ? 0.5 : 1 }}
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      </div>

      {/* RIGHT SIDE: Chart Inspector Panel */}
      {activeChart && (
        <div style={{ width: '450px', borderLeft: '1px solid #27272a', backgroundColor: '#09090b', display: 'flex', flexDirection: 'column', animation: 'slideIn 0.3s ease-out' }}>
          
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '500', color: '#e4e4e7', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart2 size={20} color="#a855f7" /> Data Inspector
            </h2>
            <button 
              onClick={() => setActiveChart(null)}
              style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', transition: 'color 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.color = '#f4f4f5'}
              onMouseOut={(e) => e.currentTarget.style.color = '#a1a1aa'}
            >
              <X size={24} />
            </button>
          </div>

          <div style={{ flex: 1, padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, maxHeight: '400px' }}>
               {renderChart(activeChart)}
            </div>
            
            {/* Data Table */}
            <div style={{ marginTop: '2rem', flex: 1, overflowY: 'auto' }}>
              <h3 style={{ fontSize: '0.9rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Data Overview</h3>
              
              <div style={{ backgroundColor: '#18181b', borderRadius: '8px', border: '1px solid #27272a', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem', color: '#e4e4e7' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#27272a', color: '#a1a1aa' }}>
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #3f3f46', fontWeight: '600' }}>Category</th>
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #3f3f46', fontWeight: '600' }}>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeChart.data.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: idx === activeChart.data.length - 1 ? 'none' : '1px solid #27272a' }}>
                        <td style={{ padding: '0.75rem 1rem' }}>{row.name}</td>
                        <td style={{ padding: '0.75rem 1rem', color: '#d8b4fe', fontWeight: '500' }}>{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
