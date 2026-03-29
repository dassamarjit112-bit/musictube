import React, { useEffect, useState } from 'react';

const AD_GAP_MS = 4 * 60 * 60 * 1000; // 4 hours in milliseconds

interface ControlledAdProps {
  isPremium: boolean;
  adSlot: string;
}

export const ControlledAd: React.FC<ControlledAdProps> = ({ isPremium, adSlot }) => {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (isPremium) {
      setShouldShow(false);
      return;
    }

    const lastAdTime = localStorage.getItem('last_ad_timestamp');
    const now = Date.now();

    if (!lastAdTime || (now - parseInt(lastAdTime || "0")) >= AD_GAP_MS) {
      setShouldShow(true);
      // We'll update the timestamp ONLY when the ad actually shows or here
      localStorage.setItem('last_ad_timestamp', now.toString());
    } else {
      setShouldShow(false);
    }
  }, [isPremium]);

  useEffect(() => {
    if (shouldShow) {
      try {
        // @ts-ignore
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        console.error("AdSense error:", e);
      }
    }
  }, [shouldShow]);

  if (!shouldShow) return null;

  return (
    <div className="ad-container" style={{ margin: '20px 0', minHeight: '100px', display: 'flex', justifyContent: 'center' }}>
      <ins 
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-2637375264334969"
        data-ad-slot={adSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
};
