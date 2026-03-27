import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';

export function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = isSignUp 
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    
    if (error) alert(error.message);
    setLoading(false);
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) alert(error.message);
  };

  return (
    <div className="google-auth-page">
      <motion.div 
        className="google-auth-card"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="google-header">
          <div className="google-brand">
            <svg viewBox="0 0 24 24" width="36" height="36">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" fill="#f00"/>
            </svg>
            <span style={{color: '#fff', fontSize: '26px', fontWeight: '800', letterSpacing: '-1px'}}>Music</span>
          </div>
          <h1>{isSignUp ? 'Create your account' : 'Sign in'}</h1>
          <p>to continue to YouTube Music</p>
        </div>

        <button onClick={signInWithGoogle} className="google-signin-btn">
          <img src="https://lh3.googleusercontent.com/COxitqgJr1sICpeqCu7IFH7I64k3-7B14mRLeuS60B8_8D-0v6S6_08I3vj7U8-p-n0=w300" alt="Google" style={{width: '24px', height: '24px'}} />
          Sign in with Google
        </button>

        <div className="auth-divider">
          <span>or use email</span>
        </div>

        <form onSubmit={handleEmailAuth} className="google-form">
          <div className="input-group">
            <input 
              type="email" 
              placeholder="Email address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>
          <div className="input-group">
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>
          
          <div className="form-actions">
            <button 
              type="button" 
              className="toggle-auth"
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp ? 'Sign in instead' : 'Create account'}
            </button>
            <button type="submit" className="blue-btn" disabled={loading}>
              {loading ? 'Wait...' : 'Next'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

