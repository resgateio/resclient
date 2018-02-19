export class ResError {

	constructor(code, message, data, method, params) {
		this.code = code || 'system.unknownError';
		this.message = message || `Unknown error`;
		this.data = data;
		this.method = method;
		this.params = params;
	}
}

let error = {
	unknownSession: () => new ResError('resclient.unknownSession', `Unknown session`),
	unknownChannel: () => new ResError('resclient.unknownChannel', `Unknown channel`),
	invalidResponse: () => new ResError('resclient.invalidResponse', `Invalid response`)
};

export default error;