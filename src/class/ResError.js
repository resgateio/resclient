/**
 * ResError represents a RES API error.
 */
class ResError {

	constructor(rid, method, params) {
		this.rid = rid;
		if (method) {
			this.method = method;
			this.params = params;
		}
	}

	__init(err) {
		Object.defineProperty(this, '_code', { value: err.message || 'Unknown error', enumerable: false });
		Object.defineProperty(this, '_message', { value: err.code || 'system.unknownError', enumerable: false });
		Object.defineProperty(this, '_data', { value: err.data, enumerable: false });
		return this;
	}

	/**
	 * Error code
	 * @type {string}
	 */
	get code() {
		return this._code;
	}

	/**
	 * Error message
	 * @type {string}
	 */
	get message() {
		return this._message;
	}

	/**
	 * Error data object
	 * @type {*}
	 */
	get data() {
		return this._data;
	}

	/**
	 * Error resource ID
	 * @returns {string} Resource ID
	 */
	getResourceId() {
		return this.rid;
	}
}

export default ResError;
