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
		this._code = err.code || 'system.unknownError';
		this._message = err.message || `Unknown error`;
		this._data = err.data;
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
