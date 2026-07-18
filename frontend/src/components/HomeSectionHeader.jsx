import React from 'react';

/** Section title row — matches Explore / mockup eyebrow + gold heading pattern. */
export default function HomeSectionHeader({ eyebrow, title, action }) {
  return (
    <div className="flex items-end justify-between gap-3 px-5 pt-6 pb-2">
      <div className="min-w-0">
        {eyebrow && <p className="ultima-eyebrow">{eyebrow}</p>}
        {title && (
          <h2 className="ultima-text-supreme mt-1 font-display text-xl font-black tracking-tight sm:text-2xl">
            {title}
          </h2>
        )}
      </div>
      {action}
    </div>
  );
}
