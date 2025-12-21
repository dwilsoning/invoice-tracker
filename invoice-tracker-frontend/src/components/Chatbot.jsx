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
        content: 'Hello! I\'m your Invoice Tracker AI assistant. I have access to your real-time analytics data including aging reports, cash flow projections, client payment trends, and risk metrics. How can I help you today?',
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
        content: 'Chat cleared. How can I help you with your invoice analytics?',
        timestamp: new Date().toISOString()
      }
    ]);
    setError(null);
  };

  const suggestedQuestions = [
    'What is my current DSI?',
    'Which clients are high risk?',
    'Show me the aging analysis',
    'What is my cash flow for the next 30 days?',
    'Who are my top 5 clients by revenue?',
    'Which clients pay the slowest?',
    'How much is overdue?',
    'What is my total pending amount?'
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
        borderRadius: '12px',
        width: '90%',
        maxWidth: '800px',
        height: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#0076A2',
          color: 'white',
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
              Invoice Analytics AI Assistant
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
              Powered by MatchaAI
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={clearChat}
              style={{
                padding: '8px 16px',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'}
              onMouseOut={(e) => e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
            >
              Clear Chat
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'}
              onMouseOut={(e) => e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
            >
              Close
            </button>
          </div>
        </div>

        {/* Messages Container */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          backgroundColor: '#f9fafb'
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
                maxWidth: '75%',
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundColor: message.role === 'user' ? '#0076A2' : message.isError ? '#FEE2E2' : '#ffffff',
                color: message.role === 'user' ? 'white' : message.isError ? '#991B1B' : '#1f2937',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word'
              }}>
                <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                  {message.content}
                </div>
                <div style={{
                  fontSize: '11px',
                  marginTop: '6px',
                  opacity: 0.7
                }}>
                  {new Date(message.timestamp).toLocaleTimeString()}
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
            <div style={{ marginTop: '20px' }}>
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                marginBottom: '12px',
                fontWeight: '500'
              }}>
                Try asking me:
              </p>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                {suggestedQuestions.map((question, idx) => (
                  <button
                    key={idx}
                    onClick={() => askSuggestedQuestion(question)}
                    style={{
                      padding: '8px 14px',
                      backgroundColor: 'white',
                      border: '1px solid #d1d5db',
                      borderRadius: '20px',
                      fontSize: '13px',
                      color: '#374151',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => {
                      e.target.style.backgroundColor = '#f3f4f6';
                      e.target.style.borderColor = '#0076A2';
                    }}
                    onMouseOut={(e) => {
                      e.target.style.backgroundColor = 'white';
                      e.target.style.borderColor = '#d1d5db';
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
          padding: '20px 24px',
          borderTop: '1px solid #e5e7eb',
          backgroundColor: 'white',
          borderBottomLeftRadius: '12px',
          borderBottomRightRadius: '12px'
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

          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about your invoice analytics..."
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '12px 16px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                resize: 'none',
                minHeight: '50px',
                maxHeight: '120px',
                fontFamily: 'inherit',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#0076A2'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              rows={2}
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              style={{
                padding: '12px 24px',
                backgroundColor: inputMessage.trim() && !isLoading ? '#0076A2' : '#9ca3af',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: inputMessage.trim() && !isLoading ? 'pointer' : 'not-allowed',
                transition: 'background-color 0.2s',
                minWidth: '80px',
                height: '50px'
              }}
              onMouseOver={(e) => {
                if (inputMessage.trim() && !isLoading) {
                  e.target.style.backgroundColor = '#005A7D';
                }
              }}
              onMouseOut={(e) => {
                if (inputMessage.trim() && !isLoading) {
                  e.target.style.backgroundColor = '#0076A2';
                }
              }}
            >
              {isLoading ? 'Sending...' : 'Send'}
            </button>
          </div>
          <p style={{
            fontSize: '12px',
            color: '#9ca3af',
            marginTop: '8px',
            marginBottom: 0
          }}>
            Press Enter to send, Shift+Enter for new line
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
