import React, { useState, useEffect, useRef } from 'react';
import { useUserAuth } from './UserAuthContext';
import styles from './RSAgentChat.module.css';
import { marked } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import ChatSessionSidebar from './ChatSessionSidebar';
import { getAuthToken } from '../utils/auth';

const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://rshub.zju.edu.cn/backend-rsagent'
  : 'http://localhost:8000';

function RSAgentChatInner() {
  const { token: tokenTmp } = useUserAuth();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatId, setChatId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const chatHistoryRef = useRef(null);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const fileInputRef = useRef(null);

  // Initialize real token check
  useEffect(() => {
    const checkRealToken = () => {
      const token = getAuthToken();
      if (!token) {
        console.error('No realToken found in RSAgentChat');
        window.dispatchEvent(new CustomEvent('auth:invalid'));
      }
    };
    checkRealToken();
  }, []);

  // Initialize markdown renderer
  useEffect(() => {
    initMarkdownRenderer();
  }, []);

  const initMarkdownRenderer = () => {
    // Custom renderer for images
    const renderer = new marked.Renderer();
    
    // Override image rendering to add click-to-enlarge and download functionality
    renderer.image = function(token) {
      const href = token.href || '';
      const title = token.title || '';
      const text = token.text || '';
      
      // Construct full URL for backend static files
      let imageUrl = href;
      if (href.startsWith('/static/')) {
        imageUrl = API_BASE_URL + href;
      }
      
      const titleAttr = title ? ` title="${title}"` : '';
      const altAttr = text ? ` alt="${text}"` : ' alt="Generated plot"';
      
      return `
        <div class="plot-image-container">
          <img 
            src="${imageUrl}" 
            ${altAttr}
            ${titleAttr}
            class="plot-image clickable"
            onclick="window.open('${imageUrl}', '_blank')"
            style="max-width: 100%; border-radius: 8px; cursor: pointer; margin: 10px 0;"
          />
          <div class="plot-image-actions" style="margin-top: 5px; font-size: 12px; color: #666;">
            <a 
              href="${imageUrl}" 
              download 
              style="color: #1976d2; text-decoration: none; margin-right: 15px;"
            >
              Download Image
            </a>
            <a 
              href="${imageUrl}" 
              target="_blank" 
              style="color: #1976d2; text-decoration: none;"
            >
              View Full Size
            </a>
          </div>
        </div>
      `;
    };
    
    marked.setOptions({
      renderer: renderer,
      highlight: function(code, language) {
        if (language && hljs.getLanguage(language)) {
          try {
            return hljs.highlight(code, { language: language }).value;
          } catch (err) {
            console.error('Highlight error:', err);
          }
        }
        return hljs.highlightAuto(code).value;
      },
      breaks: true,
      gfm: true,
    });
  };

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async (skipAutoLoad = false) => {
    setLoadingSessions(true);
    try {
      const realToken = getAuthToken();
      if (!realToken) {
        console.warn('No real token available');
        window.dispatchEvent(new CustomEvent('auth:invalid'));
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/agent/sessions`, {
        headers: {
          'Authorization': `Bearer ${realToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.sessions) {
          setSessions(data.sessions);
          
          // Load the latest session only on initial mount (not after creating new messages)
          if (data.sessions.length > 0 && !chatId && !skipAutoLoad) {
            const latestSession = data.sessions[0];
            await loadSession(latestSession.session_id);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadSession = async (sessionId) => {
    try {
      const realToken = getAuthToken();
      if (!realToken) {
        window.dispatchEvent(new CustomEvent('auth:invalid'));
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/agent/sessions/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${realToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setChatId(sessionId);
        
        // Parse messages from session data
        if (data.messages && Array.isArray(data.messages)) {
          const parsedMessages = data.messages.map((msg, index) => ({
            id: index,
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.timestamp || Date.now())
          }));
          setMessages(parsedMessages);
        }
        
        scrollToBottom();
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  const createNewSession = async () => {
    try {
      const realToken = getAuthToken();
      if (!realToken) {
        alert('Unable to get valid RSHub token, please login again');
        window.dispatchEvent(new CustomEvent('auth:invalid'));
        return;
      }

      if (!chatId && messages.length === 0) {
        console.log('Already in an empty session');
        return;
      }

      setLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/api/agent/sessions/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${realToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const newSessionId = data.session_id;
          
          setChatId(newSessionId);
          setMessages([]);
          setStreamingMessage('');
          setInputMessage('');
          
          await loadSessions(true);
          
          console.log(`New session created: ${newSessionId}`);
        } else {
          console.error('Failed to create session:', data.error);
          alert('Failed to create new session');
        }
      } else {
        console.error('Failed to create session:', response.status);
        alert('Failed to create new session');
      }
    } catch (error) {
      console.error('Failed to create new session:', error);
      alert('Failed to create new session');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const allowedTypes = ['text/plain', 'text/markdown', 'text/csv', 'application/json'];
    const allowedExtensions = ['.txt', '.md', '.csv', '.json'];
    const maxSize = 1024 * 1024;

    const validFiles = [];
    
    for (const file of files) {
      const fileExt = '.' + file.name.split('.').pop().toLowerCase();

      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExt)) {
        alert(`File "${file.name}" is not supported. Only .txt, .md, .csv, .json files are allowed.`);
        continue;
      }

      if (file.size > maxSize) {
        alert(`File "${file.name}" is too large. Maximum size is 1MB.`);
        continue;
      }

      try {
        const text = await file.text();
        validFiles.push({
          file: file,
          content: text
        });
      } catch (error) {
        console.error(`Failed to read file ${file.name}:`, error);
        alert(`Failed to read file "${file.name}"`);
      }
    }

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
    }
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClearAllFiles = () => {
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const sendMessage = async () => {
    const text = inputMessage.trim();
    if (!text || loading) return;

    const realToken = getAuthToken();
    if (!realToken) {
      alert('Unable to get valid RSHub token, please login again');
      window.dispatchEvent(new CustomEvent('auth:invalid'));
      return;
    }

    // Add user message
    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setLoading(true);
    setIsStreaming(true);
    setStreamingMessage('');

    const currentFiles = [...selectedFiles];
    handleClearAllFiles();

    try {
      const requestBody = {
        message: text,
        chat_id: chatId,
        token: realToken
      };

      if (currentFiles.length > 0) {
        requestBody.attachments = currentFiles.map(fileObj => {
          const fileType = fileObj.file.name.split('.').pop().toLowerCase();
          return {
            filename: fileObj.file.name,
            content: fileObj.content,
            file_type: fileType
          };
        });
      }

      const response = await fetch(`${API_BASE_URL}/api/agent/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error('Request failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === 'thinking') {
              setStreamingMessage(data.content || 'Thinking...');
            } else if (data.type === 'content') {
              accumulatedContent += data.delta;
              setStreamingMessage(accumulatedContent);
            } else if (data.type === 'done') {
              // Clear streaming state first to avoid duplicate display
              setStreamingMessage('');
              setIsStreaming(false);
              
              // Add assistant message
              const assistantMsg = {
                id: Date.now() + 1,
                role: 'assistant',
                content: accumulatedContent,
                timestamp: new Date()
              };
              setMessages(prev => [...prev, assistantMsg]);
              
              // Update chat ID (for both new and existing sessions)
              if (data.chat_id) {
                setChatId(data.chat_id);
                // Reload sessions list but don't auto-load any session
                await loadSessions(true);
              }
            } else if (data.type === 'error') {
              throw new Error(data.error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      
      const errorMsg = {
        id: Date.now() + 2,
        role: 'assistant',
        content: 'Sorry, an error occurred while processing your request. Please try again later.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
      setStreamingMessage('');
    } finally {
      setLoading(false);
      setIsStreaming(false);
      scrollToBottom();
    }
  };

  const renderLatex = (html) => {
    if (!html) return '';
    
    try {
      let result = html;
      
      result = result.replace(/\$\$([\s\S]+?)\$\$/g, (match, latex) => {
        try {
          return katex.renderToString(latex.trim(), {
            displayMode: true,
            throwOnError: false,
            errorColor: '#cc0000'
          });
        } catch (e) {
          console.error('KaTeX block render error:', e);
          return match;
        }
      });
      
      result = result.replace(/\$([^\$\n]+?)\$/g, (match, latex) => {
        try {
          return katex.renderToString(latex.trim(), {
            displayMode: false,
            throwOnError: false,
            errorColor: '#cc0000'
          });
        } catch (e) {
          console.error('KaTeX inline render error:', e);
          return match;
        }
      });
      
      return result;
    } catch (error) {
      console.error('LaTeX processing error:', error);
      return html;
    }
  };

  const renderMarkdown = (text) => {
    if (!text) return '';
    
    try {
      const htmlContent = marked.parse(text);
      return renderLatex(htmlContent);
    } catch (error) {
      console.error('Markdown render error:', error);
      return escapeHtml(text);
    }
  };

  const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      if (chatHistoryRef.current) {
        chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
      }
    }, 100);
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && event.ctrlKey) {
      sendMessage();
    }
  };

  const handleInputChange = (e) => {
    setInputMessage(e.target.value);
    const textarea = e.target;
    textarea.style.height = '36px';
    const newHeight = Math.min(150, Math.max(36, textarea.scrollHeight));
    textarea.style.height = newHeight + 'px';
  };

  return (
    <div className={styles.rsAgentChat}>
      <div className={styles.chatContainer}>
        <ChatSessionSidebar
          currentSessionId={chatId}
          onSessionSelect={loadSession}
          onNewChat={createNewSession}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        
        <div className={styles.chatMainArea}>
          <div className={styles.chatHistory} ref={chatHistoryRef}>
            {messages.length === 0 && (
              <div className={styles.welcomeMessage}>
                <div className={styles.suggestionCards}>
                  <div className={styles.suggestionCard} onClick={() => setInputMessage("What is RSHub?")}>
                    What is RSHub?
                  </div>
                  <div className={styles.suggestionCard} onClick={() => setInputMessage("How does DMRT-BIC model work?")}>
                    How does DMRT-BIC model work?
                  </div>
                  <div className={styles.suggestionCard} onClick={() => setInputMessage("Submit a snow modeling task")}>
                    Submit a snow modeling task
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`${styles.message} ${styles[msg.role]}`}>
                <div className={styles.messageContent}>
                  {msg.role === 'user' ? (
                    <div className={styles.userMessage}>
                      <div className={styles.messageText}>{msg.content}</div>
                    </div>
                  ) : (
                    <div className={styles.assistantMessage}>
                      <div 
                        className={`${styles.answerContent} markdown-content`} 
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                      />
                    </div>
                  )}
                </div>
                <div className={styles.messageTime}>{formatTime(msg.timestamp)}</div>
              </div>
            ))}

            {isStreaming && streamingMessage && (
              <div className={`${styles.message} ${styles.assistant}`}>
                <div className={styles.messageContent}>
                  <div className={styles.assistantMessage}>
                    <div 
                      className={`${styles.answerContent} ${styles.streaming} markdown-content`} 
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingMessage) }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className={styles.chatInput}>
            {selectedFiles.length > 0 && (
              <div className={styles.selectedFilesContainer}>
                {selectedFiles.map((fileObj, index) => (
                  <div key={index} className={styles.selectedFile}>
                    <span>{fileObj.file.name}</span>
                    <button
                      className={styles.clearFileButton}
                      onClick={() => handleRemoveFile(index)}
                      title="Remove file"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className={styles.inputArea}>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                accept=".txt,.md,.csv,.json"
                multiple
              />
              <textarea
                value={inputMessage}
                onChange={handleInputChange}
                placeholder="Enter any demand about RSHub... (Ctrl+Enter to send)"
                onKeyDown={handleKeyPress}
                disabled={loading}
                className={styles.messageInput}
                rows={1}
              />
              <button
                className={styles.addFileButton}
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                title="Add text files (.txt, .md, .csv, .json)"
              >
                +
              </button>
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || loading}
                className={`${styles.sendButton} ${loading ? styles.loading : ''}`}
              >
                {loading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('RSAgentChat Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.errorMessage}>
          <h3>Chat component failed to load</h3>
          <p>Please refresh the page or contact administrator.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function RSAgentChat(props) {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  if (!isClient) {
    return (
      <div className={styles.loadingMessage}>
        <h3>Loading AI Assistant...</h3>
      </div>
    );
  }
  
  return (
    <ErrorBoundary>
      <RSAgentChatInner {...props} />
    </ErrorBoundary>
  );
}
