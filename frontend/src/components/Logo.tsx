import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', className = '' }) => {
  const sizes = {
    sm: { text: 'text-xl', bar: 'h-[2.5px] w-4', gap: 'gap-[3px]', margin: 'mx-[2px]', tracking: 'tracking-[0.15em]' },
    md: { text: 'text-2xl', bar: 'h-[3px] w-5', gap: 'gap-[4px]', margin: 'mx-[3px]', tracking: 'tracking-[0.2em]' },
    lg: { text: 'text-4xl', bar: 'h-[5px] w-8', gap: 'gap-[6px]', margin: 'mx-[5px]', tracking: 'tracking-[0.2em]' },
    xl: { text: 'text-6xl lg:text-7xl', bar: 'h-[8px] w-16', gap: 'gap-[10px]', margin: 'mx-[12px]', tracking: 'tracking-[0.2em]' },
  };

  const s = sizes[size];

  return (
    <div className={`flex items-center font-black ${s.text} ${s.tracking} text-white select-none ${className}`}>
      <span>V</span>
      <div className={`flex flex-col ${s.gap} ${s.margin} mt-[1px]`}>
        <div className={`${s.bar} bg-primary rounded-full`} />
        <div className={`${s.bar} bg-primary rounded-full`} />
        <div className={`${s.bar} bg-primary rounded-full`} />
      </div>
      <span>ILR</span>
    </div>
  );
};
