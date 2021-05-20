// https://eslint.org/docs/user-guide/configuring
module.exports = {
	env: {
		es6: true,
	},
	globals: {
		Atomics: 'readonly',
		SharedArrayBuffer: 'readonly',
	},
	rules: {
		'sort-imports': 'off',
		'simple-import-sort/imports': [
			'error',
			{
				groups: [
					// Side effect imports.
					['^\\u0000'],
					// Packages.
					// Things that start with a letter (or digit or underscore), or `@` followed by a letter.
					['^@?\\w'],
					// Absolute imports and other imports such as Vue-style `@/foo`.
					// Anything not matched in another group.
					['^'],
					// Custom
					[
						'^@sangervasi/',
						'^src/',
					],
					// Relative imports.
					// Anything that starts with a dot.
					['^\\.'],
				],
			},
		],
		'simple-import-sort/exports': 'error',

		'comma-dangle': ['error', 'always-multiline'],
		indent: ['error', 'tab'],
		'no-mixed-spaces-and-tabs': ['warn'],
		'max-len': [
			'error',
			{
				code: 100,
				ignoreUrls: true,
			},
		],
		// 'function-paren-newline': ['error', 'consistent'],
		'linebreak-style': ['error', 'unix'],
		quotes: ['error', 'single', { avoidEscape: true }],
		'no-unused-vars': [
			'warn',
			// False positive cases:
			{
				// Ignore vars starting with init cap to ignore imported types and interfaces.
				varsIgnorePattern: '^[A-Z]',
				// Ignore function args to ignore constructor parameter properties.
				args: 'none',
			},
		],
		eqeqeq: ['error', 'smart'],
		semi: 'off',
		'@typescript-eslint/semi': ['error', 'never'],
		'@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
		'@typescript-eslint/member-delimiter-style': [
			'error',
			{
				multiline: {
					delimiter: 'none',
					requireLast: true,
				},
				singleline: {
					delimiter: 'semi',
					requireLast: false,
				},
			},
		],
	},
}
