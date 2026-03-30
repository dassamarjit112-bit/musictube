import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Headphones, ShieldCheck, Lock, User, AtSign, ArrowRight, UserPlus, LogIn, ChevronLeft } from 'lucide-react';

interface AuthProps {
  onLogin: (user: any) => void;
}

type AuthMode = 'initial' | 'email-login' | 'email-signup';

export function Auth({ onLogin }: AuthProps) {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>('initial');
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [isFlutterApp, setIsFlutterApp] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isWebView =
      (/flutter/i.test(userAgent) || (window as any).flutter_inappwebview !== undefined) &&
      window.location.port !== '8080';

    setIsFlutterApp(isWebView);
    if (isWebView) setIsSyncing(true);

    const handleNativeLogin = async (nativeUserData: any) => {
      setLoading(true);
      setIsSyncing(false);
      try {
        const userToSync = {
          id: nativeUserData.id || nativeUserData.sub,
          email: nativeUserData.email,
          full_name: nativeUserData.name || nativeUserData.full_name || 'User',
          avatar_url: nativeUserData.picture || nativeUserData.avatar_url || '',
        };

        const { error: upsertError } = await supabase.from('profiles').upsert(userToSync);
        if (upsertError) console.error("Native Profile sync error:", upsertError.message);

        localStorage.setItem('ytm_user', JSON.stringify(userToSync));
        onLogin(userToSync);
      } catch (err) {
        console.error("Flutter App Sync failed:", err);
      } finally {
        setLoading(false);
      }
    };

    (window as any).onNativeLoginSuccess = handleNativeLogin;

    return () => {
      delete (window as any).onNativeLoginSuccess;
    };
  }, [onLogin]);

  const handleSupabaseGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'email-signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName }
          }
        });

        if (error) throw error;
        
        if (data.user) {
          const newUser = {
            id: data.user.id,
            email: data.user.email,
            full_name: fullName || 'New User',
            avatar_url: '',
            subscription_tier: 'free'
          };
          localStorage.setItem('ytm_user', JSON.stringify(newUser));
          onLogin(newUser);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        if (data.user) {
          // Fetch profile details
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          const existingUser = {
            id: data.user.id,
            email: data.user.email,
            full_name: profile?.full_name || 'User',
            avatar_url: profile?.avatar_url || '',
            subscription_tier: profile?.subscription_tier || 'free'
          };
          localStorage.setItem('ytm_user', JSON.stringify(existingUser));
          onLogin(existingUser);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (isFlutterApp && isSyncing) {
    return (
      <div className="app-loader-container">
        <div className="mini-loader" />
        <p>Syncing your profile...</p>
        <button className="bypass-btn" onClick={() => setIsSyncing(false)}>Skip Sync</button>
      </div>
    );
  }

  return (
    <div className="auth-container-v2">
      <div className="auth-bg-overlay" />
      
      <motion.div
        className="auth-card-v2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="auth-header-v2">
          {mode !== 'initial' && (
            <button className="back-btn-v2" onClick={() => { setMode('initial'); setError(null); }}>
              <ChevronLeft size={20} />
            </button>
          )}
          <div className="auth-logo-v2">
            <img src="/logo.png" alt="MusicTube" className="auth-logo-img" />
            <h1 className="auth-title-v2">MusicTube</h1>
          </div>
          <p className="auth-subtitle-v2">
            {mode === 'email-signup' ? 'Create your account' : mode === 'email-login' ? 'Welcome back' : 'Connect your music universe'}
          </p>
        </div>

        <div className="auth-content-v2">
          <AnimatePresence mode="wait">
            {mode === 'initial' ? (
              <motion.div 
                key="initial"
                initial={{ opacity: 0, x: -10 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: 10 }}
                className="auth-options-v2"
              >
                <button
                  onClick={handleSupabaseGoogleLogin}
                  disabled={loading}
                  className="google-btn-premium"
                >
                  {loading ? <div className="mini-loader" /> : (
                    <>
                      <img src="https://www.gstatic.com/images/branding/googleg/1x/googleg_standard_color_128dp.png" className="google-icon-v2" alt="Google" />
                      Continue with Google
                    </>
                  )}
                </button>

                <div className="auth-divider-v2">
                  <span>OR</span>
                </div>

                <div className="email-options-v2">
                  <button className="email-action-btn" onClick={() => setMode('email-login')}>
                    <LogIn size={18} />
                    Login with Email
                  </button>
                  <button className="email-action-btn signup" onClick={() => setMode('email-signup')}>
                    <UserPlus size={18} />
                    Create New Account
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.form 
                key="form"
                initial={{ opacity: 0, x: 10 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -10 }}
                className="auth-form-v2"
                onSubmit={handleEmailAuth}
              >
                {mode === 'email-signup' && (
                  <div className="input-group-v2">
                    <User size={18} className="input-icon" />
                    <input 
                      type="text" 
                      placeholder="Full Name" 
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required 
                    />
                  </div>
                )}
                
                <div className="input-group-v2">
                  <AtSign size={18} className="input-icon" />
                  <input 
                    type="email" 
                    placeholder="Email Address" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required 
                  />
                </div>

                <div className="input-group-v2">
                  <Lock size={18} className="input-icon" />
                  <input 
                    type="password" 
                    placeholder="Password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                  />
                </div>

                {error && <div className="auth-error-v2">{error}</div>}

                <button type="submit" disabled={loading} className="submit-auth-btn">
                  {loading ? <div className="mini-loader" /> : (
                    <>
                      {mode === 'email-signup' ? 'Create Account' : 'Sign In'}
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>

                <p className="form-toggle-v2">
                  {mode === 'email-signup' ? 'Already have an account?' : "Don't have an account?"}
                  <button type="button" onClick={() => setMode(mode === 'email-signup' ? 'email-login' : 'email-signup')}>
                    {mode === 'email-signup' ? 'Login' : 'Sign Up'}
                  </button>
                </p>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="auth-benefits-v2">
            <div className="benefit-item-v2">
              <Headphones size={20} className="benefit-icon-v2" />
              <span>Listen and discover music you love.</span>
            </div>
            <div className="benefit-item-v2">
              <ShieldCheck size={20} className="benefit-icon-v2" />
              <span>Safe and secure authentication.</span>
            </div>
          </div>
        </div>

        <div className="auth-footer-v2">
          <p>By continuing, you agree to our Terms and Conditions.</p>
          <div className="secure-badge-v2">
            <ShieldCheck size={12} /> Secure Account
          </div>
        </div>
      </motion.div>
    </div>
  );
}
