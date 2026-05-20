import React, { useState, useEffect } from 'react';
import { useUserAuth } from './UserAuthContext';
import styles from './ChatSessionSidebar.module.css';
import { getAuthToken } from '../utils/auth';

const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://rshub.zju.edu.cn/backend-rsagent'
  : 'http://localhost:8000';

export default function ChatSessionSidebar({ 
  currentSessionId, 
  onSessionSelect, 
  onNewChat,
  isCollapsed,
  onToggleCollapse 
}) {
  const { token: tokenTmp } = useUserAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const realToken = getAuthToken();
      if (!realToken) {
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
        }
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteSession = async (sessionId, e) => {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this chat session?')) {
      return;
    }

    try {
      const realToken = getAuthToken();
      if (!realToken) {
        alert('Please login first');
        window.dispatchEvent(new CustomEvent('auth:invalid'));
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/agent/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${realToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSessions(sessions.filter(s => s.session_id !== sessionId));
          
          if (currentSessionId === sessionId) {
            onNewChat();
          }
        } else {
          alert('Failed to delete session: ' + (data.error || 'Unknown error'));
        }
      } else {
        alert('Failed to delete session');
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
      alert('Failed to delete session');
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (isCollapsed) {
    return (
      <div className={styles.collapsedSidebar}>
        <button 
          className={styles.toggleButton}
          onClick={onToggleCollapse}
          title="Expand chat history"
        >
          ☰
        </button>
      </div>
    );
  }

  return (
    <div className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <button 
          className={styles.toggleButton}
          onClick={onToggleCollapse}
          title="Collapse"
        >
          ☰
        </button>
        <h3 className={styles.sidebarTitle}>Chat History</h3>
        <button 
          className={styles.newChatButton}
          onClick={async () => {
            await onNewChat();
          }}
        >
          + New
        </button>
      </div>

      <div className={styles.sessionList}>
        {loading ? (
          <div className={styles.loadingMessage}>Loading...</div>
        ) : sessions.length === 0 ? (
          <div className={styles.emptyMessage}>No chat history yet</div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.session_id}
              className={`${styles.sessionItem} ${
                session.session_id === currentSessionId ? styles.active : ''
              }`}
              onClick={() => onSessionSelect(session.session_id)}
            >
              <div className={styles.sessionTitle}>
                <span className={styles.titleText}>{session.title}</span>
                <button
                  className={styles.deleteButton}
                  onClick={(e) => deleteSession(session.session_id, e)}
                  title="Delete session"
                >
                  ×
                </button>
              </div>
              <div className={styles.sessionMeta}>
                <span className={styles.sessionTime}>
                  {formatDate(session.updated_at)}
                </span>
                <span className={styles.sessionMessages}>
                  {session.message_count} msgs
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

