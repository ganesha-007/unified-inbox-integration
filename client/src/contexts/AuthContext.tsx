import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { User, AuthState, LoginFormData, RegisterFormData, ApiResponse } from '../types';

// Set up axios base URL
axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

interface AuthContextType extends AuthState {
  login: (credentials: LoginFormData) => Promise<void>;
  register: (userData: RegisterFormData) => Promise<void>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Set up axios interceptor for authentication
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Check if user is authenticated on app load
  useEffect(() => {
    const checkAuth = async (): Promise<void> => {
      if (token) {
        try {
          // Verify token by making a request to get user info
          const response = await axios.get<ApiResponse<{ user: User }>>('/api/auth/me');
          if (response.data.success && response.data.data) {
            setUser(response.data.data.user);
          } else {
            throw new Error('Invalid response format');
          }
        } catch (error) {
          // Token is invalid, remove it
          localStorage.removeItem('token');
          setToken(null);
          setError('Session expired. Please login again.');
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, [token]);

  const login = async (credentials: LoginFormData): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.post<ApiResponse<{ user: User; token: string }>>('/api/auth/login', credentials);
      
      if (response.data.success && response.data.data) {
        const { user: userData, token: userToken } = response.data.data;
        setUser(userData);
        setToken(userToken);
        localStorage.setItem('token', userToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${userToken}`;
      } else {
        throw new Error(response.data.error || 'Login failed');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Login failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData: RegisterFormData): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.post<ApiResponse<{ user: User; token: string }>>('/api/auth/register', userData);
      
      if (response.data.success && response.data.data) {
        const { user: newUser, token: userToken } = response.data.data;
        setUser(newUser);
        setToken(userToken);
        localStorage.setItem('token', userToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${userToken}`;
      } else {
        throw new Error(response.data.error || 'Registration failed');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Registration failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const logout = (): void => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setError(null);
  };

  const updateUser = async (userData: Partial<User>): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.put<ApiResponse<{ user: User }>>('/api/auth/profile', userData);
      
      if (response.data.success && response.data.data) {
        setUser(response.data.data.user);
      } else {
        throw new Error(response.data.error || 'Update failed');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Update failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isLoading: loading,
    error,
    login,
    register,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
