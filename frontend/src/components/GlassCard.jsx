import React from 'react';

function GlassCard({ children, className = '', neon = 'medium', as: Tag = 'div', ...rest }) {
  const neonClass =
    neon === 'high'
      ? 'shadow-glass-strong border-indigo-400/30'
      : neon === 'low'
        ? 'shadow-none border-white/5'
        : 'shadow-glass border-white/10';

  return (
    <Tag
      className={`glass-panel ${neonClass} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export default React.memo(GlassCard);
