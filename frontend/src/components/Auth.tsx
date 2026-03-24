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
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="google-header">
          <svg className="google-logo" viewBox="0 0 24 24" width="75" height="24">
            <path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none" stroke="currentColor" strokeWidth="2"/>
            <rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor"/>
          </svg>
          <div className="google-brand">
            <span style={{color: '#4285F4'}}>G</span>
            <span style={{color: '#EA4335'}}>o</span>
            <span style={{color: '#FBBC05'}}>o</span>
            <span style={{color: '#4285F4'}}>g</span>
            <span style={{color: '#34A853'}}>l</span>
            <span style={{color: '#EA4335'}}>e</span>
          </div>
          <h1>{isSignUp ? 'Create a Google Account' : 'Sign in'}</h1>
          <p>to continue to YouTube Music</p>
        </div>

        <button onClick={signInWithGoogle} className="google-signin-btn">
          <img src="https://www.google.com/favicon.ico" alt="Google icon" />
          Continue with Google
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
              {loading ? '...' : 'Next'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

