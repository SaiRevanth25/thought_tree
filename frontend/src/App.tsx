import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { LoginPage } from './components/LoginPage';
import { ChatPage } from './components/ChatPage';
import { UserProfilePage } from './components/UserProfilePage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { isAuthenticated } from './utils/auth';
import { getCurrentUser } from './utils/api';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [loading, setLoading] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const hasChecked = useRef(false);

  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;

    const checkAuth = async () => {
      if (!isAuthenticated()) {
        setLoading(false);
        setIsValid(false);
        return;
      }

      try {
        await getCurrentUser();
        setIsValid(true);
      } catch (error) {
        console.error('Auth check failed:', error);
        setIsValid(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return isValid ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      if (isAuthenticated()) {
        try {
          await getCurrentUser();
          setIsAuth(true);
        } catch (error) {
          console.error('Auth validation failed:', error);
          setIsAuth(false);
        }
      } else {
        setIsAuth(false);
      }
      setAuthChecked(true);
    };

    checkAuth();
  }, []);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={isAuth ? <Navigate to="/chat" replace /> : <LoginPage />}
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <UserProfilePage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
