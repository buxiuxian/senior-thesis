import React, { useState } from 'react';
import { useUserAuth } from './UserAuthContext';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import styles from './CustomNavbar.module.css';

export default function CustomNavbar() {
  const { isLoggedIn, username, logout } = useUserAuth();
  const { siteConfig } = useDocusaurusContext();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = () => {
    logout();
    setShowDropdown(false);
    // 重定向到首页
    window.location.href = '/';
  };

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.navbarContainer}>
        <div className={styles.navbarBrand}>
          <Link to="/" className={styles.navbarLogo}>
            <img src="/img/rshub.png" alt="RSHub Logo" className={styles.logo} />
            <span className={styles.brandText}>{siteConfig.title}</span>
          </Link>
        </div>

        <div className={styles.navbarItems}>
          <Link to="/GettingStarted" className={styles.navbarItem}>
            Getting Started
          </Link>
          <Link to="/Scenarios" className={styles.navbarItem}>
            Scenarios
          </Link>
          <Link to="/Acknowledgements" className={styles.navbarItem}>
            Acknowledgements
          </Link>
        </div>

        <div className={styles.navbarRight}>
          {isLoggedIn ? (
            <div className={styles.userSection}>
              <button 
                className={styles.userButton}
                onClick={toggleDropdown}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              >
                <img src="/img/Credit1.jpg" alt="User" className={styles.userAvatar} />
                <span className={styles.username}>{username}</span>
                <span className={styles.dropdownArrow}>▼</span>
              </button>
              
              {showDropdown && (
                <div className={styles.dropdown}>
                  <Link to="/UserPage" className={styles.dropdownItem}>
                    My Profile
                  </Link>
                  <button onClick={handleLogout} className={styles.dropdownItem}>
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/Login" className={styles.loginButton}>
              <img src="/img/Credit1.jpg" alt="Login" className={styles.loginIcon} />
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
} 