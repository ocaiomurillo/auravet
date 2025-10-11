import type { SVGProps } from 'react';

const LogoAuravet = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 120 120"
    xmlns="http://www.w3.org/2000/svg"
    aria-labelledby="auravetLogoTitle"
    role="img"
    {...props}
  >
    <title id="auravetLogoTitle">Logo Auravet</title>
    <defs>
      <linearGradient id="auravetGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#A7C7A0" />
        <stop offset="100%" stopColor="#3D6655" />
      </linearGradient>
    </defs>
    <path
      d="M59.8 107.2c-1.7-1.4-42.3-34.5-42.3-60 0-14.2 11.2-25.4 25.4-25.4 7.9 0 15 3.6 19.4 9.6 4.4-6 11.5-9.6 19.4-9.6 14.2 0 25.4 11.2 25.4 25.4 0 25.5-40.6 58.6-42.3 60a4.4 4.4 0 0 1-5 0Z"
      fill="url(#auravetGradient)"
    />
    <circle cx="44" cy="33" r="8" fill="#F8FAF9" />
    <circle cx="76" cy="33" r="8" fill="#F8FAF9" />
    <circle cx="60" cy="18" r="7" fill="#F8FAF9" />
    <path
      d="M60 65c-7.8-7.2-20.2-7.7-28.8-1.1 4.9 12.4 19.5 24 28.6 30.2 9.1-6.2 23.7-17.8 28.6-30.2C80.2 57.3 67.8 57.8 60 65Z"
      fill="#0F172A"
      opacity="0.12"
    />
    <path
      d="M84 58c-4.2 0-8.1-1.6-11-4.5a3 3 0 1 1 4.2-4.2c3.7 3.7 9.9 3.7 13.6 0a3 3 0 1 1 4.2 4.2A15.4 15.4 0 0 1 84 58Z"
      fill="#F8FAF9"
    />
  </svg>
);

export default LogoAuravet;
