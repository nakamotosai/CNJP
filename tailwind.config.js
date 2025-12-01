/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
        './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                primary: 'var(--primary)',
                background: 'var(--background)',
                card: 'var(--card)',
                'text-main': 'var(--text-main)',
                'text-sub': 'var(--text-sub)',
                'text-aux': 'var(--text-aux)',
                border: 'var(--border)',
            },
            fontFamily: {
                sans: 'var(--font-sans)',
                serif: 'var(--font-serif)',
            },
            boxShadow: {
                'card': '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.05)',
            }
        },
    },
    plugins: [],
};
