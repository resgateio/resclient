export default function(a, b) {
	return typeof a === 'object' && a !== null && typeof a.equals === 'function'
		? a.equals(b)
		: a === b;
}
