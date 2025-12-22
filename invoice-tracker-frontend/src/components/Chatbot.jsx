import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';

const Chatbot = ({ onClose }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const { token } = useAuth();

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Add welcome message on mount
  useEffect(() => {
    setMessages([
      {
        role: 'assistant',
        content: 'Hello! I\'m Sage, your expert Finance Specialist for the Altera APAC Invoice Tracker.\n\nI specialise in invoice management, accounts receivable analytics, and aged debt recovery. I have access to your real-time analytics including:\n\n• DSO and aging analysis\n• Cash flow projections\n• Payment velocity and trends\n• Risk metrics and alerts\n• Client payment patterns\n\nI\'ll provide clear insights, actionable recommendations, and proactive alerts to help you optimise your accounts receivable. How can I assist you today?',
        timestamp: new Date().toISOString()
      }
    ]);
  }, []);

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString()
    };

    // Add user message to chat
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    try {
      // Prepare chat history for API (MatchaAI format)
      const chatHistory = messages
        .filter(msg => msg.role !== 'system')
        .map(msg => ({
          role: msg.role,
          content: msg.role === 'assistant'
            ? [{ type: 'output_text', text: msg.content }]
            : msg.content
        }));

      // Send to backend
      const response = await axios.post(
        `${API_URL}/chatbot/query`,
        {
          message: inputMessage,
          chatHistory
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        const assistantMessage = {
          role: 'assistant',
          content: response.data.message,
          timestamp: response.data.timestamp
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error(response.data.error || 'Failed to get response');
      }
    } catch (err) {
      console.error('Chatbot error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to send message');

      // Add error message to chat
      const errorMessage = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${err.response?.data?.error || err.message || 'Unknown error'}. Please try again.`,
        timestamp: new Date().toISOString(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: 'Chat cleared. I\'m ready to provide fresh insights on your invoice analytics. What would you like to know?',
        timestamp: new Date().toISOString()
      }
    ]);
    setError(null);
  };

  const suggestedQuestions = [
    'What is my current DSO?',
    'Which clients should I chase this week?',
    'Show me the aging analysis',
    'Are there any critical alerts?',
    'Which clients are high risk?',
    'What is my cash flow for the next 30 days?',
    'Who are my top 5 clients by revenue?',
    'Are there any payment pattern issues?'
  ];

  const askSuggestedQuestion = (question) => {
    setInputMessage(question);
    inputRef.current?.focus();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10000
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        width: '90%',
        maxWidth: '900px',
        height: '88vh',
        maxHeight: '900px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0, 0, 0, 0.35)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 28px',
          borderBottom: 'none',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #0076A2 0%, #005A7D 100%)',
          color: 'white',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '26px',
              fontWeight: '700',
              border: '3px solid rgba(255, 255, 255, 0.4)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
            }}>
              S
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700', letterSpacing: '-0.02em' }}>
                Sage
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', opacity: 0.95, fontWeight: '400' }}>
                Finance Specialist • Invoice Analytics Expert
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={clearChat}
              style={{
                padding: '10px 18px',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'all 0.2s',
                backdropFilter: 'blur(10px)'
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.25)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.5)';
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              }}
            >
              🔄 Clear
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '10px 18px',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                border: 'none',
                borderRadius: '8px',
                color: '#0076A2',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = 'white';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Messages Container */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '28px',
          background: 'linear-gradient(to bottom, #f8fafc 0%, #f1f5f9 100%)'
        }}>
          {messages.map((message, index) => (
            <div
              key={index}
              style={{
                marginBottom: '16px',
                display: 'flex',
                justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start'
              }}
            >
              <div style={{
                maxWidth: '80%',
                padding: '14px 18px',
                borderRadius: message.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                backgroundColor: message.role === 'user' ? '#0076A2' : message.isError ? '#FEE2E2' : '#ffffff',
                color: message.role === 'user' ? 'white' : message.isError ? '#991B1B' : '#1f2937',
                boxShadow: message.role === 'user' ? '0 2px 8px rgba(0, 118, 162, 0.3)' : '0 2px 12px rgba(0, 0, 0, 0.08)',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
                border: message.role === 'assistant' && !message.isError ? '1px solid rgba(0, 0, 0, 0.06)' : 'none'
              }}>
                <div style={{ fontSize: '15px', lineHeight: '1.7' }}>
                  {message.content}
                </div>
                <div style={{
                  fontSize: '11px',
                  marginTop: '8px',
                  opacity: message.role === 'user' ? 0.8 : 0.6,
                  fontWeight: '500'
                }}>
                  {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div style={{
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'flex-start'
            }}>
              <div style={{
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundColor: '#ffffff',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
              }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#0076A2',
                    animation: 'pulse 1.4s ease-in-out infinite'
                  }} />
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#0076A2',
                    animation: 'pulse 1.4s ease-in-out 0.2s infinite'
                  }} />
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#0076A2',
                    animation: 'pulse 1.4s ease-in-out 0.4s infinite'
                  }} />
                </div>
              </div>
            </div>
          )}

          {/* Suggested Questions */}
          {messages.length === 1 && !isLoading && (
            <div style={{ marginTop: '24px' }}>
              <p style={{
                fontSize: '13px',
                color: '#64748b',
                marginBottom: '14px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                💡 Suggested Questions
              </p>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                {suggestedQuestions.map((question, idx) => (
                  <button
                    key={idx}
                    onClick={() => askSuggestedQuestion(question)}
                    style={{
                      padding: '10px 16px',
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      fontSize: '13px',
                      color: '#475569',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontWeight: '500',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
                    }}
                    onMouseOver={(e) => {
                      e.target.style.backgroundColor = '#0076A2';
                      e.target.style.borderColor = '#0076A2';
                      e.target.style.color = 'white';
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 4px 8px rgba(0, 118, 162, 0.3)';
                    }}
                    onMouseOut={(e) => {
                      e.target.style.backgroundColor = 'white';
                      e.target.style.borderColor = '#e2e8f0';
                      e.target.style.color = '#475569';
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
                    }}
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{
          padding: '24px 28px',
          borderTop: '2px solid #e5e7eb',
          backgroundColor: '#ffffff',
          boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.05)'
        }}>
          {error && (
            <div style={{
              padding: '10px 12px',
              backgroundColor: '#FEE2E2',
              color: '#991B1B',
              borderRadius: '6px',
              fontSize: '13px',
              marginBottom: '12px'
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask Sage about your invoices, DSO, cash flow, aging..."
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '14px 18px',
                border: '2px solid #e2e8f0',
                borderRadius: '12px',
                fontSize: '15px',
                resize: 'none',
                minHeight: '56px',
                maxHeight: '140px',
                fontFamily: 'inherit',
                outline: 'none',
                transition: 'all 0.2s',
                backgroundColor: '#fafbfc'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#0076A2';
                e.target.style.backgroundColor = 'white';
                e.target.style.boxShadow = '0 0 0 3px rgba(0, 118, 162, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0';
                e.target.style.backgroundColor = '#fafbfc';
                e.target.style.boxShadow = 'none';
              }}
              rows={2}
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              style={{
                padding: '14px 28px',
                backgroundColor: inputMessage.trim() && !isLoading ? '#0076A2' : '#cbd5e1',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '700',
                cursor: inputMessage.trim() && !isLoading ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                minWidth: '100px',
                height: '56px',
                boxShadow: inputMessage.trim() && !isLoading ? '0 2px 8px rgba(0, 118, 162, 0.3)' : 'none'
              }}
              onMouseOver={(e) => {
                if (inputMessage.trim() && !isLoading) {
                  e.target.style.backgroundColor = '#005A7D';
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 4px 12px rgba(0, 118, 162, 0.4)';
                }
              }}
              onMouseOut={(e) => {
                if (inputMessage.trim() && !isLoading) {
                  e.target.style.backgroundColor = '#0076A2';
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 2px 8px rgba(0, 118, 162, 0.3)';
                }
              }}
            >
              {isLoading ? '⏳' : '📨'} {isLoading ? 'Sending...' : 'Send'}
            </button>
          </div>
          <p style={{
            fontSize: '12px',
            color: '#94a3b8',
            marginTop: '10px',
            marginBottom: 0,
            fontWeight: '500'
          }}>
            💬 Press Enter to send • Shift+Enter for new line
          </p>
        </div>
      </div>

      {/* Add keyframe animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.3;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default Chatbot;
