
// Deep equal comparison
function eq(a, b) {
	if (a === b) return true;

	if (a && b && typeof a == 'object' && typeof b == 'object') {
		var length, i, keys;
		if (Array.isArray(a)) {
			length = a.length;
			if (length != b.length) return false;
			for (i = length; i-- !== 0;) {
				if (!eq(a[i], b[i])) return false;
			}
			return true;
		}

		keys = Object.keys(a);
		length = keys.length;
		if (length !== Object.keys(b).length) return false;

		for (i = length; i-- !== 0;)
			if (!b.hasOwnProperty(keys[i])) return false;

		for (i = length; i-- !== 0;) {
			var key = keys[i];
			if (!eq(a[key], b[key])) return false;
		}

		return true;
	}

	return false;
}

export default function(a, b) {
	return typeof a === 'object' && a !== null && typeof a.equals === 'function'
		? a.equals(b)
		: eq(a, b);
};
