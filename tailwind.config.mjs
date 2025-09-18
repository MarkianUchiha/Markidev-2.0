/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
			animation: {
				'meteor-shower': 'meteor 5s linear infinite',
			},
			typography: {
				DEFAULT: {
					css: {
						'figure.video': {
							'margin-top': '2em',
							'margin-bottom': '2em',
						},
						'figure.image': {
							'margin-top': '2em',
							'margin-bottom': '2em',
						},
						iframe: {
							'border-radius': '0.75rem',
							'box-shadow': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
							'width': '100%',
							'aspect-ratio': '16/9',
						},
					},
				},
			},
			keyframes: {
				meteor: {
					'0%': {
						transform: 'rotate(215deg) translateX(0)',
						opacity: '1',
					},
					'70%': {
						opacity: '1',
					},
					'100%': {
						transform: 'rotate(215deg) translateX(-500px)',
						opacity: '0',
					},
				},
			},
		},
	},
	plugins: [
		require('@tailwindcss/typography'),
	],
};