import React from 'react';

function Bar({ className = '' }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-slate-800/80 ${className}`}
    >
      <div className="absolute inset-0 animate-shimmer-slide bg-[length:200%_100%] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50" />
    </div>
  );
}

function SkeletonStream({ rows = 3 }) {
  return (
    <div className="flex w-full flex-col gap-3 px-4 pb-24 pt-6">
      <Bar className="h-8 w-40" />
      <Bar className="h-24 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Bar key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

export default React.memo(SkeletonStream);
