import React, { createContext, useContext, useState, useEffect } from 'react';

const UserAuthContext = createContext();

export const useUserAuth = () => {
  const context = useContext(UserAuthContext);
  if (!context) {
    throw new Error('useUserAuth must be used within a UserAuthProvider');
  }
  return context;
};

export const UserAuthProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');

  useEffect(() => {
    // 检查本地存储中的登录状态
    if (typeof window === 'undefined') return; // 防止SSR错误
    
    const storedToken = localStorage.getItem('tokenTmp');
    const storedLoginStatus = localStorage.getItem('LoggedIn');
    
    if (storedToken && storedLoginStatus === 'True') {
      setToken(storedToken);
      setIsLoggedIn(true);
      
      // 获取用户信息
      fetch('https://rshub.zju.edu.cn/users/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenTmp: storedToken
        }),
      })
      .then(response => response.json())
      .then(data => {
        if (data.result) {
          setUsername(data.username);
        } else {
          // 如果token无效，清除登录状态
          logout();
        }
      })
      .catch(error => {
        console.error('Error fetching user profile:', error);
        logout();
      });
    }
  }, []);

  const login = async (userToken, userData) => {
    if (typeof window === 'undefined' || !localStorage) {
      return;
    }

    try {
      localStorage.setItem('tokenTmp', userToken);
      localStorage.setItem('LoggedIn', 'True');

      const profileResponse = await fetch('https://rshub.zju.edu.cn/users/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tokenTmp: userToken }),
      });

      if (!profileResponse.ok) {
        throw new Error('Failed to fetch profile');
      }

      const profileData = await profileResponse.json();
      
      if (!profileData.result || !profileData.token) {
        throw new Error('Failed to get realToken from profile');
      }

      localStorage.setItem('realToken', profileData.token);

      setToken(userToken);
      setIsLoggedIn(true);
      setUsername(userData.username);
    } catch (error) {
      console.error('Login failed:', error);
      logout();
      throw error;
    }
  };

  const logout = () => {
    setToken('');
    setIsLoggedIn(false);
    setUsername('');
    
    // 确保在客户端环境下操作localStorage
    if (typeof window !== 'undefined' && localStorage) {
      localStorage.removeItem('tokenTmp');
      localStorage.removeItem('LoggedIn');
      localStorage.removeItem('realToken'); // 清除真正的token
    }
  };

  const value = {
    isLoggedIn,
    username,
    token,
    login,
    logout
  };

  return (
    <UserAuthContext.Provider value={value}>
      {children}
    </UserAuthContext.Provider>
  );
}; 