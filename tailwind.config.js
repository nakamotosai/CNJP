/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                primary: 'var(--primary)',
                accent: 'var(--accent)',
                background: 'var(--background)',
                card: 'var(--card)',
                'text-main': 'var(--text-main)',
                'text-sub': 'var(--text-sub)',
                border: 'var(--border)',
            },
            fontFamily: {
                sans: 'var(--font-sans)',
                serif: 'var(--font-serif)',
            },
        },
    },
    plugins: [],
};
