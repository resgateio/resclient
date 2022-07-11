/**
 * ResRef represents a soft resource reference value.
 */
class ResRef {

	/**
	 * Creates a ResRef instance
	 * @param {ResClient} api ResClient instance
	 * @param {string} rid Resource id.
	 */
	constructor(api, rid) {
		Object.defineProperty(this, '_rid', { value: rid, enumerable: false });
		Object.defineProperty(this, '_api', { value: api, enumerable: false });
	}

	/**
	 * Referenced resource ID.
	 * @returns {string} Resource ID.
	 */
	get rid() {
		return this._rid;
	}

	/**
	 * Get referenced resource.
	 * @return {Promise.<(ResModel|ResCollection)>} Promise of the resource.
	 */
	get() {
		return this._api.get(this._rid);
	}

	/**
	 * Tests if another ResRef object is equivalent to this instance.
	 * @param {*} o Value to test equality against.
	 * @returns {boolean} True if equal, otherwise false.
	 */
	equals(o) {
		return o instanceof ResRef && o._api === this._api && o._rid === this._rid;
	}

	toJSON() {
		return { "rid": this._rid };
	}
}

export default ResRef;
