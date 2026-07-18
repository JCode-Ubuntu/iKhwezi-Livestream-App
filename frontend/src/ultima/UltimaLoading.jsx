import React from 'react';
import { Capacitor } from '@capacitor/core';
import UltimaField from './UltimaField';
import { IKHWEZI_LOGO_URL } from '../config/brandAssets';
import '../components/Splash.css';

function UltimaLoading() {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    return (
      <div className="splash-root" style={{ position: 'fixed' }}>
        <div className="splash-aurora" />
        <div className="splash-content">
          <img src={IKHWEZI_LOGO_URL} alt="iKhwezi" className="splash-logo-image" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-void-950">
      <UltimaField intensity={1.4} />
      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="ultima-logo-ring flex h-20 w-20 items-center justify-center rounded-[28px]">
          <span className="font-display text-2xl font-black tracking-tighter text-gold-300">iK</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <p className="ultima-eyebrow">Supreme Edition</p>
          <p className="ultima-serif text-sm text-white/50">Stream the night</p>
        </div>
        <div className="ultima-loader-bar h-0.5 w-32 overflow-hidden rounded-full bg-white/10">
          <div className="ultima-loader-fill h-full w-1/3 rounded-full bg-gradient-to-r from-gold-400 via-pink-500 to-pink-300" />
        </div>
      </div>
    </div>
  );
}

export default UltimaLoading;
