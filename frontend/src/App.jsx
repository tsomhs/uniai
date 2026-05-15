import React, { useState, useRef, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Send, User, Bot, Loader2 } from 'lucide-react';

function App() {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hello! I am connected to your JSONL dataset. What would you like to know?', chart: null }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to the bottom of the chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      // Pointing to your new Python FastAPI server (No Azure!)
      const response = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });

      const data = await response.json();
      
      // We expect the backend to return { reply: "Text...", chartData: [...], chartType: "bar" }
      setMessages((prev) => [...prev, { 
        role: 'assistant', 
        text: data.reply || "Here is the data you requested.",
        chart: data.chartData ? { type: data.chartType, data: data.chartData } : null
      }]);

    } catch (error) {
      console.error("Error communicating with backend:", error);
      setMessages((prev) => [...prev, { role: 'assistant', text: "Sorry, I couldn't connect to the backend server. Is FastAPI running?" }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to render the correct chart type based on LLM response
  const renderChart = (chartInfo) => {
    if (!chartInfo || !chartInfo.data) return null;

    return (
      <div style={{ height: '300px', width: '100%', marginTop: '1rem', backgroundColor: 'white', padding: '1rem', borderRadius: '8px' }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartInfo.type === 'line' ? (
            <LineChart data={chartInfo.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          ) : (
            <BarChart data={chartInfo.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#f3f4f6', fontFamily: 'sans-serif' }}>
      
      {/* Header */}
      <header style={{ backgroundColor: '#1e40af', color: 'white', padding: '1rem', textAlign: 'center', fontSize: '1.25rem', fontWeight: 'bold' }}>
        Speak With Your Data
      </header>

      {/* Chat Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        {messages.map((msg, index) => (
          <div key={index} style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
            
            {/* Avatar */}
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: msg.role === 'user' ? '#3b82f6' : '#10b981', color: 'white' }}>
              {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
            </div>

            {/* Message Bubble */}
            <div style={{ maxWidth: '80%', padding: '1rem', borderRadius: '8px', backgroundColor: msg.role === 'user' ? '#bfdbfe' : '#ffffff', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
              <p style={{ margin: 0, lineHeight: '1.5' }}>{msg.text}</p>
              {/* Render chart if the AI sent one */}
              {renderChart(msg.chart)}
            </div>
          </div>
        ))}
        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6b7280' }}>
            <Loader2 className="animate-spin" size={20} /> AI is analyzing your data...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{ backgroundColor: 'white', padding: '1rem', borderTop: '1px solid #e5e7eb' }}>
        <form onSubmit={handleSend} style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your data... (e.g., 'Show me sales as a bar chart')"
            style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none', fontSize: '1rem' }}
            disabled={isLoading}
          />
          <button 
            type="submit" 
            disabled={isLoading || !input.trim()}
            style={{ backgroundColor: '#3b82f6', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}
          >
            Send <Send size={18} />
          </button>
        </form>
      </div>

    </div>
  );
}

export default App;