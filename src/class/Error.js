export default class ResError {

	constructor(rid, method, params) {
		this.rid = rid;
		if (method) {
			this.method = method;
			this.params = params;
		}
	}

	__init(err) {
		this.code = err.code || 'system.unknownError';
		this.message = err.message || `Unknown error`;
		this.data = err.data;
	}

	getResourceId() {
		return this.rid;
	}
}
