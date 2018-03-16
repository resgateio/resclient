import { Server } from 'mock-socket';
import ResClient from './ResClient.js';

class ResServer extends Server {
	constructor(url) {
		super(url);

		this.error = null;
		this.requests = [];
		this.usedRequestIds = {};
		this.on('message', this._onMessage.bind(this));
	}

	isConnected() {
		return this.clients().length > 0;
	}

	getNextRequest() {
		return this.requests.shift();
	}

	pendingRequests() {
		return this.requests.length;
	}

	sendResponse(req, result) {
		let json = JSON.stringify({ id: req.id, result });
		this.send(json);
	}

	_onMessage(msg) {
		let req;
		try {
			req = JSON.parse(msg);
		} catch (ex) {
			this.error = new Error("Invalid request: " + msg);
			return;
		}

		if (!req.hasOwnProperty('id')) {
			this.error = new Error("Request missing id property: " + msg);
			return;
		}

		if (!req.hasOwnProperty('method')) {
			this.error = new Error("Request missing method property: " + msg);
			return;
		}

		if (this.usedRequestIds[req.id]) {
			this.error = new Error("Multiple request with the same id property: " + msg);
		}
		this.usedRequestIds[req.id] = true;

		this.requests.push(req);
	}
}

describe('ResClient', () => {

	let port = 1000;
	let server;
	let client;
	let model = {
		foo: "bar",
		int: 42
	};

	function flushPromises(depth = 2) {
		jest.runOnlyPendingTimers();
		return new Promise(resolve => setImmediate(() => {
			depth--;
			if (depth) {
				flushPromises(depth).then(resolve);
			} else {
				resolve();
			}
		}));
	}

	function getModel(rid) {
		let promise = client.getResource(rid);

		return flushPromises().then(() => {
			let req = server.getNextRequest();
			server.sendResponse(req, model);
			jest.runOnlyPendingTimers();
			return promise;
		});
	}

	jest.useFakeTimers();

	beforeEach(() => {
		let url = "ws://localhost:" + port;
		port++;
		server = new ResServer(url);
		client = new ResClient(url);
	});

	afterEach(() => {
		server.stop();
	});

	describe('connect', () => {
		it('connects on connect', (done) => {
			client.connect();
			jest.runAllTimers();
			expect(server.isConnected()).toBe(true);
			done();
		});

		it('connects on getResource', () => {
			client.getResource('service.test');

			return flushPromises().then(() => {
				expect(server.isConnected()).toBe(true);
			});
		});

		it('disconnects on disconnect', () => {
			let promise = client.connect().then(() => {
				client.disconnect();
				jest.runAllTimers();
				expect(server.isConnected()).toBe(false);
			});
			jest.runOnlyPendingTimers();
			return promise;
		});
	});

	describe('getResource model', () => {
		it('gets model resource from server', () => {
			let promise = client.getResource('service.model').then(model => {
				expect(model.foo).toBe("bar");
			});

			return flushPromises().then(() => {
				let req = server.getNextRequest();
				expect(req).not.toBe(undefined);
				expect(req.method).toBe('subscribe.service.model');
				server.sendResponse(req, {
					foo: "bar"
				});
				jest.runOnlyPendingTimers();
				expect(server.error).toBe(null);
				expect(server.pendingRequests()).toBe(0);

				return promise;
			});
		});

		it('gets model resource from cache on second request', () => {
			return getModel('service.model').then(model => {
				return client.getResource('service.model').then(modelSecond => {
					expect(model).toBe(modelSecond);

					let req = server.getNextRequest();
					expect(req).toBe(undefined);
				});
			});
		});

		it('unsubscribe model not listened too, removing it from cache', () => {
			return getModel('service.model').then(model => {
				// Cause unsubscribe by waiting
				return flushPromises().then(() => {
					let req = server.getNextRequest();
					expect(req).not.toBe(undefined);
					expect(req.method).toBe('unsubscribe.service.model');
					server.sendResponse(req, null);

					// Wait for the unsubscribe response
					return flushPromises(3).then(() => {
						let promise = client.getResource('service.model').then(modelSecond => {
							expect(model).not.toBe(modelSecond);

							let req = server.getNextRequest();
							expect(req).toBe(undefined);
						});

						return flushPromises().then(promise);
					});
				});
			});
		});
	});
});
