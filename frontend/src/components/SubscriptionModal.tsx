import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Check, Zap, Star, Gift, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SubscriptionModalProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
  onRefreshUser: (updatedUser: any) => void;
  initialGiftCode?: string;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ user, isOpen, onClose, onRefreshUser, initialGiftCode }) => {
  const [loading, setLoading] = useState(false);
  const [giftCode, setGiftCode] = useState(initialGiftCode || '');
  const [giftError, setGiftError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  React.useEffect(() => {
    if (initialGiftCode) setGiftCode(initialGiftCode);
  }, [initialGiftCode, isOpen]);

  const handleRazorpay = async (plan: string, originalAmount: number) => {
    setLoading(true);
    let amount = originalAmount;

    // UPGRADE LOGIC: Cut basic amount if already subscribed
    if (user?.subscription_tier === 'basic' && plan === 'Premium') {
      amount = originalAmount - 199; // Difference (399 - 199 = 200)
    }

    const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID;
    if (!keyId || keyId.includes('PLACEHOLDER')) {
      alert("Razorpay Key ID is not configured in .env file.");
      setLoading(false);
      return;
    }

    const options = {
      key: keyId,
      amount: amount * 100, // in paise
      currency: "INR",
      name: "MusicTube Premium",
      description: `Lifetime ${plan} Subscription`,
      image: "/logo.png",
      handler: async function (response: any) {
        // In a real app, verify signature on backend
        console.log("Payment Success:", response);
        await updateSubscriptionInSupabase(plan === 'Premium');
      },
      prefill: {
        name: user?.full_name || "",
        email: user?.email || "",
      },
      theme: {
        color: "#6600ff"
      }
    };

    // @ts-ignore
    const rzp = new window.Razorpay(options);
    rzp.open();
    setLoading(false);
  };

  const handleSuccessfulUpgrade = (tier: string, isLocal: boolean = false) => {
    const updated = { ...user, id: user?.id || 'flutter_guest_id', subscription_tier: tier };
    localStorage.setItem('ytm_user', JSON.stringify(updated));
    setSuccessMessage(`🎉 ${tier === 'premium' ? 'Premium Pro' : 'Basic'} activated! ${isLocal ? '(Locally Synced)' : ''}`);
    
    // Automatically close the modal and refresh the app state after a brief delay
    setTimeout(() => {
      onRefreshUser(updated);
      onClose(); // Explicitly trigger the close logic if onRefreshUser doesn't
      setSuccessMessage('');
    }, 2500);
  };

  const updateSubscriptionInSupabase = async (isPremium: boolean) => {
    const tier = isPremium ? 'premium' : 'basic';
    const effectiveUserId = user?.id || 'flutter_guest_id';
    const isGuest = effectiveUserId === 'flutter_guest_id';
    
    // For Guests, we only update LocalStorage and refresh the UI
    if (isGuest) {
      console.log("Syncing Guest Offline Tier...");
      handleSuccessfulUpgrade(tier, true);
      return;
    }

    // Registered Users, Sync to Supabase
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({ 
          id: user.id, 
          subscription_tier: tier,
          email: user.email || '',
          full_name: user.full_name || '',
          avatar_url: user.avatar_url || '',
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
      
      if (!error) {
        handleSuccessfulUpgrade(tier, false);
      } else {
        throw error;
      }
    } catch (e: any) {
       console.error("Supabase sync failed (likely RLS or ID format):", e);
       handleSuccessfulUpgrade(tier, true); // Fallback to local
    }
  };

  const handleGiftCode = async () => {
    const trimmedCode = giftCode.trim().toUpperCase();
    if (!trimmedCode) return;
    setLoading(true);
    setGiftError('');

    try {
      // Step 1: Look up the gift code (case-insensitive match)
      const { data, error: fetchError } = await supabase
        .from('gift_codes')
        .select('id, code, tier, is_used')
        .ilike('code', trimmedCode)
        .single();

      if (fetchError) {
        console.error('Gift code fetch error:', fetchError.message);
        setGiftError('Code not found. Check spelling and try again.');
        return;
      }

      if (!data) {
        setGiftError('Gift code not found.');
        return;
      }

      if (data.is_used) {
        setGiftError('This gift code has already been used.');
        return;
      }

      // Step 2: Mark the code as used (null if guest to avoid UUID errors)
      const isGuest = !user?.id || user.id === 'flutter_guest_id';
      const { error: updateError } = await supabase
        .from('gift_codes')
        .update({ 
          is_used: true, 
          used_by: isGuest ? null : user.id 
        })
        .eq('id', data.id)
        .eq('is_used', false); // Double-check it wasn't used in between

      if (updateError) {
        console.error('Gift code update error:', updateError.message);
        setGiftError('Failed to redeem code. Please try again.');
        return;
      }

      // Step 3: Update user subscription (it handles showing the success message)
      const isPremium = data.tier === 'premium';
      await updateSubscriptionInSupabase(isPremium);
      setGiftCode('');

    } catch (e: any) {
      console.error('Gift code error:', e);
      setGiftError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <motion.div 
        className="modal-card"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
      >
        <div className="modal-header">
          <div className="brand">
            <img src="/logo.png" alt="" />
            <h2>MusicTube Premium</h2>
          </div>
          <button onClick={onClose} className="modal-close">
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          {successMessage ? (
            <div className="modal-success-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring" }}
              >
                <div style={{ width: 80, height: 80, background: '#4caf50', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                  <Check size={48} color="#fff" />
                </div>
              </motion.div>
              <h2 style={{ fontSize: 24, marginBottom: 12 }}>Welcome aboard!</h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {successMessage}
              </p>
            </div>
          ) : (
            <>
              <div className="modal-grid">
                {/* Basic Plan */}
                <div className="modal-plan-card">
              <div className="plan-type">
                <Zap size={16} /> Lifetime Basic
              </div>
              <h3 className="plan-price">₹199</h3>
              <p className="plan-desc">Support the developer and get lifetime access to MusicTube.</p>
              
              <ul className="plan-feats">
                <li><Check size={16} color="#4caf50" /> Lifetime access</li>
                <li><Check size={16} color="#4caf50" /> All core features</li>
                <li><Shield size={16} color="#aaa" /> Contains Ads</li>
              </ul>

              <button 
                disabled={loading || user?.subscription_tier === 'basic' || user?.subscription_tier === 'premium'}
                onClick={() => handleRazorpay('Basic', 199)}
                className="modal-pay-btn"
              >
                {user?.subscription_tier === 'basic' || user?.subscription_tier === 'premium' ? 'Current Tier' : 'Buy Now'}
              </button>
            </div>

            {/* Premium Plan */}
            <div className="modal-plan-card pro">
              <div className="rec-badge">Recommended</div>
              <div className="plan-type">
                <Star size={16} fill="currentColor" /> Lifetime Pro
              </div>
              <h3 className="plan-price">₹399</h3>
              <p className="plan-desc">The ultimate music experience. No interruptions, ever.</p>
              
              <ul className="plan-feats">
                <li><Check size={16} color="#4caf50" /> Ad-Free Experience</li>
                <li><Check size={16} color="#4caf50" /> Future App Updates</li>
                <li><Check size={16} color="#4caf50" /> Priority Support</li>
              </ul>

              <button 
                disabled={loading || user?.subscription_tier === 'premium'}
                onClick={() => handleRazorpay('Premium', 399)}
                className="modal-pay-btn"
              >
                {user?.subscription_tier === 'premium' 
                  ? 'Current Tier' 
                  : (user?.subscription_tier === 'basic' ? 'Upgrade for ₹200' : 'Go Premium')}
              </button>
            </div>
          </div>

          <div className="modal-gift-section">
            <p><Gift size={18} /> Have a gift code?</p>
            <div className="gift-inputs">
              <input 
                type="text" 
                placeholder="Enter code"
                readOnly={loading}
                value={giftCode}
                onChange={(e) => setGiftCode(e.target.value)}
              />
              <button 
                disabled={loading || !giftCode.trim()}
                onClick={handleGiftCode}
              >
                {loading ? '...' : 'Redeem'}
              </button>
            </div>
                {giftError && <p style={{ color: '#ff4444', fontSize: '13px', marginTop: '12px' }}>{giftError}</p>}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};
