import React from 'react';
import { cn } from '../../utils/cn';

export interface HRIllustrationProps {
  className?: string;
}

export const HRIllustration: React.FC<HRIllustrationProps> = ({ className }) => {
  return (
    <div className={cn('relative w-full max-w-[500px] mx-auto select-none', className)}>
      <svg
        viewBox="0 0 520 380"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto drop-shadow-sm"
        role="img"
        aria-label="HR operations coordinator managing employee onboarding and task workflows at a contemporary office desk"
      >
        <defs>
          {/* Subtle Ambient Lavender Background */}
          <linearGradient id="bgLavender" x1="260" y1="30" x2="260" y2="350" gradientUnits="userSpaceOnUse">
            <stop stopColor="#EDE7FF" stopOpacity="0.85" />
            <stop stopColor="#F5F1FF" stopOpacity="0.35" />
          </linearGradient>

          {/* Primary Violet Gradient */}
          <linearGradient id="violetPrimaryGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6938EF" />
            <stop offset="100%" stopColor="#8056F5" />
          </linearGradient>

          {/* Gentle Card Elevation Filter */}
          <filter id="gentleElevation" x="-10%" y="-10%" width="125%" height="130%" filterUnits="userSpaceOnUse">
            <feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="#24212E" floodOpacity="0.06" />
          </filter>
        </defs>

        {/* Soft Circular Backdrop */}
        <circle cx="260" cy="190" r="155" fill="url(#bgLavender)" />
        <ellipse cx="260" cy="340" rx="190" ry="16" fill="#E7E3EF" opacity="0.6" />

        {/* Minimal Decorative Dots */}
        <g opacity="0.3" fill="#8056F5">
          <circle cx="85" cy="80" r="2.5" />
          <circle cx="105" cy="80" r="2.5" />
          <circle cx="85" cy="100" r="2.5" />
          <circle cx="105" cy="100" r="2.5" />
          <circle cx="420" cy="260" r="2" />
          <circle cx="438" cy="260" r="2" />
          <circle cx="420" cy="278" r="2" />
          <circle cx="438" cy="278" r="2" />
        </g>

        {/* Office Desk Plant (Left) */}
        <g id="officePlant">
          {/* Plant Pot */}
          <path d="M75 285L80 330C80.5 334 83.5 336 87 336H113C116.5 336 119.5 334 120 330L125 285H75Z" fill="#FFFFFF" stroke="#E7E3EF" strokeWidth="1.5" />
          <rect x="72" y="280" width="56" height="7" rx="3.5" fill="#EDE7FF" stroke="#DCD0FF" strokeWidth="1" />
          
          {/* Organic Green Leaves */}
          <path d="M100 280Q98 240 85 215" stroke="#16A36A" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M100 265Q112 235 120 210" stroke="#16A36A" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M85 215C72 205 68 185 80 178C92 185 92 205 85 215Z" fill="#16A36A" />
          <path d="M120 210C132 200 136 180 124 172C112 180 112 200 120 210Z" fill="#16A36A" opacity="0.9" />
          <path d="M102 245C92 230 96 210 108 205C116 214 114 235 102 245Z" fill="#16A36A" opacity="0.8" />
        </g>

        {/* Supporting Card 1: Employee Onboarding Profile (Top Left) */}
        <g id="profileCard" filter="url(#gentleElevation)">
          <rect x="40" y="65" width="160" height="74" rx="12" fill="#FFFFFF" stroke="#E7E3EF" strokeWidth="1.2" />
          {/* Avatar Icon */}
          <circle cx="68" cy="95" r="14" fill="#EDE7FF" />
          <circle cx="68" cy="91" r="5" fill="#6938EF" />
          <path d="M59 104C59 100 63 98 68 98C73 98 77 100 77 104" stroke="#6938EF" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          
          {/* Employee Info Lines */}
          <rect x="90" y="86" width="65" height="6" rx="3" fill="#24212E" />
          <rect x="90" y="96" width="45" height="4" rx="2" fill="#A09BAE" />
          
          {/* Onboarding Status Pill */}
          <rect x="90" y="106" width="62" height="15" rx="7.5" fill="#F0FDF4" />
          <circle cx="98" cy="113.5" r="2.5" fill="#16A36A" />
          <text x="104" y="116.5" fill="#16A36A" fontSize="7.5" fontFamily="Inter, sans-serif" fontWeight="600">Onboarding</text>
        </g>

        {/* Modern Minimal Desk */}
        <g id="deskGroup">
          {/* Desk Top */}
          <rect x="235" y="260" width="200" height="10" rx="5" fill="#FFFFFF" stroke="#E7E3EF" strokeWidth="1.5" />
          {/* Desk Legs */}
          <path d="M260 270L255 336" stroke="#A09BAE" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M415 270L425 336" stroke="#A09BAE" strokeWidth="3.5" strokeLinecap="round" />
          
          {/* Sleek Laptop */}
          <rect x="275" y="253" width="70" height="7" rx="3" fill="#24212E" />
          <path d="M282 198L338 198L343 253L287 253Z" fill="#24212E" rx="3" />
          <path d="M285 202L335 202L339 249L289 249Z" fill="#F5F1FF" />
          
          {/* Laptop Screen Content: HR Workflow View */}
          <rect x="294" y="212" width="22" height="4" rx="2" fill="#6938EF" />
          <rect x="294" y="220" width="36" height="3" rx="1.5" fill="#777387" />
          <rect x="294" y="226" width="28" height="3" rx="1.5" fill="#A09BAE" />
          <circle cx="330" cy="235" r="5" fill="#16A36A" opacity="0.2" />
          <path d="M328 235L330 237L333 233" stroke="#16A36A" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />

          {/* Coffee Cup */}
          <rect x="380" y="244" width="12" height="15" rx="3" fill="#FFFFFF" stroke="#E7E3EF" strokeWidth="1.2" />
          <path d="M392 248C395 248 397 250 397 253C397 256 395 258 392 258" stroke="#E7E3EF" strokeWidth="1.5" fill="none" />
        </g>

        {/* Contemporary Office Chair */}
        <g id="chairGroup">
          <path d="M210 336H265" stroke="#777387" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M238 300V336" stroke="#777387" strokeWidth="5" strokeLinecap="round" />
          <circle cx="210" cy="338" r="3.5" fill="#24212E" />
          <circle cx="265" cy="338" r="3.5" fill="#24212E" />
          {/* Seat Cushion */}
          <rect x="195" y="278" width="75" height="16" rx="8" fill="#5425CB" />
          {/* Backrest */}
          <rect x="185" y="170" width="20" height="110" rx="9" fill="#6938EF" />
        </g>

        {/* HR Operations Coordinator (Professional Character) */}
        <g id="hrCoordinator">
          {/* Legs & Shoes */}
          <path d="M225 288L252 312V336" stroke="#24212E" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M248 336H270" stroke="#5425CB" strokeWidth="7" strokeLinecap="round" />

          {/* Torso & Attire */}
          <path d="M212 210C212 182 240 182 245 210L254 278H212L212 210Z" fill="url(#violetPrimaryGrad)" />
          {/* Minimal Collar */}
          <path d="M226 188L230 202L234 188" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />

          {/* Head & Hair */}
          <circle cx="232" cy="155" r="18" fill="#FCD3B8" />
          <path d="M218 156C216 138 232 132 244 136C252 140 250 152 245 157C242 147 228 144 220 149Z" fill="#24212E" />
          {/* Subtle Glasses */}
          <rect x="226" y="152" width="12" height="7" rx="2" fill="none" stroke="#24212E" strokeWidth="1.4" />
          
          {/* Arms typing smoothly */}
          <path d="M220 205L255 240L295 250" stroke="#8056F5" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="296" cy="250" r="4" fill="#FCD3B8" />

          <path d="M232 205L265 238L305 249" stroke="url(#violetPrimaryGrad)" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="306" cy="249" r="4" fill="#FCD3B8" />
        </g>

        {/* Supporting Card 2: HR Task List / Follow-up Checklist (Top Right) */}
        <g id="tasksCard" filter="url(#gentleElevation)">
          <rect x="330" y="75" width="150" height="85" rx="12" fill="#FFFFFF" stroke="#E7E3EF" strokeWidth="1.2" />
          
          <rect x="345" y="88" width="55" height="5" rx="2.5" fill="#24212E" />
          
          {/* Task 1 (Checked) */}
          <circle cx="350" cy="106" r="5" fill="#EDE7FF" />
          <path d="M348 106L349.5 107.5L352.5 104.5" stroke="#6938EF" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="360" y="104" width="60" height="4" rx="2" fill="#777387" />

          {/* Task 2 (Checked) */}
          <circle cx="350" cy="122" r="5" fill="#EDE7FF" />
          <path d="M348 122L349.5 123.5L352.5 120.5" stroke="#6938EF" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="360" y="120" width="75" height="4" rx="2" fill="#777387" />

          {/* Task 3 (Pending) */}
          <circle cx="350" cy="138" r="5" fill="#F5F1FF" stroke="#DCD0FF" strokeWidth="1" />
          <rect x="360" y="136" width="48" height="4" rx="2" fill="#A09BAE" />
        </g>
      </svg>
    </div>
  );
};
