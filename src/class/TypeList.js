/**
 * TypeList holds registered resource factory callbacks
 */
class TypeList {

	/**
	 * Creates a TypeList instance
	 * @param {ResClient~resourceFactoryCallback} defaultFactory Default factory function
	 */
	constructor(defaultFactory) {
		this.root = {};
		this.defaultFactory = defaultFactory;
	}

	/**
	 * Adds a resource factory callback to a pattern.
	 * The pattern may use the following wild cards:
	 * * The asterisk (*) matches any part at any level of the resource name.
	 * * The greater than symbol (>) matches one or more parts at the end of a resource name, and must be the last part.
	 * @param {string} pattern Pattern of the resource type.
	 * @param {ResClient~resourceFactoryCallback} factory Resource factory callback
	 */
	addFactory(pattern, factory) {
		let tokens = pattern.split('.');
		let l = this.root;
		let n;
		let sfwc = false;

		for (let t of tokens) {
			let lt = t.length;
			if (!lt || sfwc) {
				throw new Error("Invalid pattern");
			}

			if (lt > 1) {
				if (l.nodes) {
					n = l.nodes[t] = l.nodes[t] || {};
				} else {
					l.nodes = {};
					n = l.nodes[t] = {};
				}
			} else {
				if (t[0] === '*') {
					n = l.pwc = l.pwc || {};
				} else if (t[0] === '>') {
					n = l.fwc = l.fwc || {};
					sfwc = true;
				} else if (l.nodes) {
					n = l.nodes[t] = l.nodes[t] || {};
				} else {
					l.nodes = {};
					n = l.nodes[t] = {};
				}
			}
			l = n;
		}

		if (l.factory) {
			throw new Error("Pattern already registered");
		}

		l.factory = factory;
	}

	/**
	 * Gets the factory callback that best matches the pattern.
	 * Matching will give priority to text, then to *-wildcards, and last to >-wildcards.
	 * @param {string} rid Resource ID
	 * @returns {ResClient~resourceFactoryCallback} Factory callback
	 */
	getFactory(rid) {
		let tokens = rid.replace(/\?.*$/, '').split('.');
		return this._match(tokens, 0, this.root) || this.defaultFactory;
	}

	_match(ts, i, l) {
		let t = ts[i++];
		let c = 2;
		let n = l.nodes ? l.nodes[t] : undefined;
		while (c--) {
			if (n) {
				if (ts.length === i) {
					if (n.factory) {
						return n.factory;
					}
				} else {
					let f = this._match(ts, i, n);
					if (f) {
						return f;
					}
				}
			}
			n = l.pwc;
		}
		n = l.fwc;
		return n && n.factory;
	}
}

export default TypeList;
