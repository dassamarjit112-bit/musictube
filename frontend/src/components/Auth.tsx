import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Headphones, ShieldCheck, Lock, User, AtSign, ArrowRight, UserPlus, LogIn, ChevronLeft } from 'lucide-react';

interface AuthProps {
  onLogin: (user: any) => void;
}

type AuthPage = 'landing' | 'login' | 'register' | 'complete-profile';

export function Auth({ onLogin }: AuthProps) {
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState<AuthPage>('landing');
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if we just returned from OAuth and need to complete profile
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // If it's a social login, check if profile is complete (mock check)
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        
        // If no profile or missing fullName, assume we need setup (common for new OAuth)
        if (!profile || !profile.full_name) {
          setActivePage('complete-profile');
        } else {
          onLogin({
            id: session.user.id,
            email: session.user.email,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url || '',
            subscription_tier: profile.subscription_tier || 'free'
          });
        }
      }
    };
    
    checkSession();
  }, [onLogin]);

  const handleOAuth = async (provider: 'google' | 'github') => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin }
    });
    if (error) { setError(error.message); setLoading(false); }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (activePage === 'register' || activePage === 'complete-profile') {
        let authResult;
        if (activePage === 'register') {
          authResult = await supabase.auth.signUp({
            email, password, options: { data: { full_name: fullName } }
          });
          if (authResult.error) throw authResult.error;
        } else {
          // Setting password for existing account (OAuth complete profile)
          const { error } = await supabase.auth.updateUser({ password, data: { full_name: fullName } });
          if (error) throw error;
          const { data: { user } } = await supabase.auth.getUser();
          authResult = { data: { user } };
        }
        
        if (authResult.data.user) {
          const u = authResult.data.user;
          const userObj = {
            id: u.id,
            email: u.email,
            full_name: fullName || u.user_metadata?.full_name || 'User',
            avatar_url: u.user_metadata?.avatar_url || '',
            subscription_tier: 'free'
          };
          localStorage.setItem('ytm_user', JSON.stringify(userObj));
          onLogin(userObj);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) {
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
          const userObj = {
            id: data.user.id,
            email: data.user.email,
            full_name: profile?.full_name || 'User',
            avatar_url: profile?.avatar_url || '',
            subscription_tier: profile?.subscription_tier || 'free'
          };
          localStorage.setItem('ytm_user', JSON.stringify(userObj));
          onLogin(userObj);
        }
      }
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const renderLanding = () => (
    <motion.div key="landing" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="auth-step-container">
      <div className="auth-hero-section">
        <Headphones size={48} className="hero-icon" />
        <h2>Your Music, Anywhere.</h2>
        <p>Premium streaming experience for the true music enthusiast.</p>
      </div>
      
      <div className="social-login-grid">
        <button onClick={() => handleOAuth('google')} className="social-pill-btn google">
          <img src="https://www.gstatic.com/images/branding/googleg/1x/googleg_standard_color_128dp.png" alt="G" />
          Continue with Google
        </button>
      </div>

      <div className="auth-divider-v2"><span>OR USE EMAIL</span></div>

      <div className="landing-actions">
        <button className="primary-glass-btn" onClick={() => setActivePage('login')}>
          <LogIn size={20} /> Sign In
        </button>
        <button className="secondary-glass-btn" onClick={() => setActivePage('register')}>
          <UserPlus size={20} /> Create Account
        </button>
      </div>
    </motion.div>
  );

  const renderForm = (type: 'login' | 'register' | 'complete-profile') => (
    <motion.form key={type} initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="auth-standalone-form" onSubmit={handleEmailAuth}>
      <header className="form-head">
        <button type="button" className="mini-back" onClick={() => setActivePage('landing')}><ChevronLeft size={20} /></button>
        <h3>{type === 'login' ? 'Sign In' : type === 'register' ? 'Join MusicTube' : 'Finalize Profile'}</h3>
        <p>{type === 'complete-profile' ? 'Please set a password and name for your account.' : 'Enter your details below to continue.'}</p>
      </header>

      {(type === 'register' || type === 'complete-profile') && (
        <div className="modern-input-group">
          <label>Full Name</label>
          <div className="input-field-v2">
            <User size={18} />
            <input type="text" placeholder="John Doe" value={fullName} onChange={e => setFullName(e.target.value)} required />
          </div>
        </div>
      )}

      {type !== 'complete-profile' && (
        <div className="modern-input-group">
          <label>Email Address</label>
          <div className="input-field-v2">
            <AtSign size={18} />
            <input type="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
        </div>
      )}

      <div className="modern-input-group">
        <label>Password</label>
        <div className="input-field-v2">
          <Lock size={18} />
          <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
      </div>

      {error && <div className="modern-auth-error">{error}</div>}

      <button type="submit" disabled={loading} className="giant-gradient-btn">
        {loading ? <div className="mini-loader" /> : (
          <>{type === 'login' ? 'Sign In' : (type === 'register' ? 'Create Account' : 'Complete Setup')} <ArrowRight size={20} /></>
        )}
      </button>

      {type !== 'complete-profile' && (
        <p className="form-footer-switch">
          {type === 'login' ? "Don't have an account?" : "Already have an account?"}
          <span onClick={() => setActivePage(type === 'login' ? 'register' : 'login')}>
            {type === 'login' ? ' Register Now' : ' Login Instead'}
          </span>
        </p>
      )}
    </motion.form>
  );

  return (
    <div className="auth-overlay-premium">
      <div className="auth-background-canvas" />
      <div className="auth-scroll-container">
        <div className="auth-inner-card">
          <div className="auth-branding-v4">
            <img src="/logo.png" alt="MusicTube" />
            <h1>MusicTube</h1>
          </div>
          
          <AnimatePresence mode="wait">
            {activePage === 'landing' ? renderLanding() : renderForm(activePage)}
          </AnimatePresence>

          <footer className="auth-security-footer">
            <ShieldCheck size={14} /> End-to-end secure authentication powered by Supabase
          </footer>
        </div>
      </div>
    </div>
  );
}
