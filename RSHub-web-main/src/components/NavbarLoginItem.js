import React, { useState } from 'react';
import { useUserAuth } from './UserAuthContext';
import Link from '@docusaurus/Link';
import { useColorMode } from '@docusaurus/theme-common';

// 自定义确认对话框组件
function ConfirmDialog({ isOpen, onConfirm, onCancel, message }) {
  const { colorMode } = useColorMode();
  
  if (!isOpen) return null;

  return (
    <div 
      className="confirm-dialog-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={onCancel}
    >
      <div 
        className="confirm-dialog-content"
        style={{
          backgroundColor: colorMode === 'dark' ? 'var(--ifm-background-color)' : '#fff',
          padding: '2rem',
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          maxWidth: '400px',
          width: '90%',
          color: colorMode === 'dark' ? 'var(--ifm-font-color-base)' : '#333',
          border: colorMode === 'dark' ? '1px solid var(--ifm-color-emphasis-300)' : 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem' }}>确认操作</h3>
        <p style={{ margin: '0 0 1.5rem 0', lineHeight: '1.5' }}>{message}</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '0.5rem 1rem',
              border: `1px solid ${colorMode === 'dark' ? 'var(--ifm-color-emphasis-300)' : '#ccc'}`,
              backgroundColor: 'transparent',
              color: colorMode === 'dark' ? 'var(--ifm-font-color-base)' : '#666',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              backgroundColor: '#dc3545',
              color: '#fff',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            确定退出
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NavbarLoginItem() {
  const { isLoggedIn, username, logout } = useUserAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { colorMode } = useColorMode();

  const handleLogoutClick = () => {
    setShowDropdown(false);
    setShowConfirmDialog(true);
  };

  const handleConfirmLogout = () => {
    setShowConfirmDialog(false);
    logout();
    // 重定向到首页
    window.location.href = '/';
  };

  const handleCancelLogout = () => {
    setShowConfirmDialog(false);
  };

  const toggleDropdown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDropdown(!showDropdown);
  };

  // 改进的事件处理 - 使用鼠标进入/离开而不是点击外部
  const handleMouseEnter = () => {
    setShowDropdown(true);
  };

  const handleMouseLeave = () => {
    // 添加延迟，给用户时间移动到下拉菜单
    setTimeout(() => {
      setShowDropdown(false);
    }, 150);
  };

  if (isLoggedIn) {
    return (
      <>
        <div 
          className="navbar__item dropdown dropdown--hoverable dropdown--right user-dropdown"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{
            // 根据主题模式调整样式
            color: colorMode === 'dark' ? 'var(--ifm-navbar-link-color)' : 'inherit',
          }}
        >
          <a 
            href="#"
            className="navbar__link"
            onClick={toggleDropdown}
            aria-haspopup="true"
            aria-expanded={showDropdown}
            role="button"
            style={{
              color: colorMode === 'dark' ? 'var(--ifm-navbar-link-color)' : 'inherit',
            }}
          >
            <img 
              src="/img/Credit1.jpg" 
              alt="User" 
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                marginRight: '0.5rem',
                // 深色模式下稍微调整透明度
                opacity: colorMode === 'dark' ? '0.9' : '1',
              }}
            />
            <b>{username}</b>
          </a>
          
          <ul 
            className={`dropdown__menu user-dropdown__menu ${showDropdown ? 'user-dropdown__menu--visible' : ''}`}
            style={{
              // 确保在深色模式下正确显示
              backgroundColor: colorMode === 'dark' ? 'var(--ifm-dropdown-background-color)' : undefined,
              borderColor: colorMode === 'dark' ? 'var(--ifm-color-emphasis-300)' : undefined,
            }}
          >
            <li>
              <Link 
                to="/UserPage" 
                className="dropdown__link"
                onClick={() => setShowDropdown(false)}
                style={{
                  color: colorMode === 'dark' ? 'var(--ifm-dropdown-link-color)' : undefined,
                }}
              >
                My Profile
              </Link>
            </li>
            <li>
              <button 
                onClick={handleLogoutClick}
                className="dropdown__link"
                style={{
                  background: 'none',
                  border: 'none',
                  width: '100%',
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: colorMode === 'dark' ? 'var(--ifm-dropdown-link-color)' : undefined,
                }}
              >
                Logout
              </button>
            </li>
          </ul>
        </div>
        
        <ConfirmDialog
          isOpen={showConfirmDialog}
          onConfirm={handleConfirmLogout}
          onCancel={handleCancelLogout}
          message="确定要退出登录吗？退出后您需要重新登录才能访问用户功能。"
        />
      </>
    );
  }

  return (
    <Link 
      to="/Login" 
      className="navbar__item navbar__link"
      style={{
        display: 'flex',
        alignItems: 'center',
        backgroundColor: colorMode === 'dark' 
          ? 'rgba(255, 255, 255, 0.05)' 
          : 'rgba(255, 255, 255, 0.1)',
        borderRadius: '0.375rem',
        padding: '0.5rem 1rem',
        color: colorMode === 'dark' ? 'var(--ifm-navbar-link-color)' : 'inherit',
      }}
    >
      <img 
        src="/img/Credit1.jpg" 
        alt="Login" 
        style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          marginRight: '0.5rem',
          opacity: colorMode === 'dark' ? '0.9' : '1',
        }}
      />
      Login
    </Link>
  );
} 