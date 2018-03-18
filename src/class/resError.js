export class ResError {

	constructor(code, message, data, method, params) {
		this.code = code || 'system.unknownError';
		this.message = message || `Unknown error`;
		this.data = data;
		this.method = method;
		this.params = params;
	}
}
