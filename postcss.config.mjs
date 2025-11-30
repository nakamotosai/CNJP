/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    // 注意：这里变成了 @tailwindcss/postcss
    "@tailwindcss/postcss": {},
  },
};

export default config;