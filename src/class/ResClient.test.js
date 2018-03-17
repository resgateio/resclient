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
	const modelData = {
		foo: "bar",
		int: 42
	};

	function flushPromises(depth = 2) {
		return new Promise(resolve => setImmediate(() => {
			depth--;
			if (depth) {
				flushPromises(depth).then(resolve);
			} else {
				resolve();
			}
		}));
	}

	function flushRequests(depth = 2, time = 10) {
		jest.advanceTimersByTime(time);
		return new Promise(resolve => setImmediate(() => {
			depth--;
			if (depth) {
				flushRequests(depth).then(resolve);
			} else {
				resolve();
			}
		}));
	}

	function waitAWhile(time = 10000) {
		jest.advanceTimersByTime(time);
		return flushPromises();
	}

	function getResource(rid, data) {
		let promise = client.getResource(rid);

		return flushRequests().then(() => {
			let req = server.getNextRequest();
			server.sendResponse(req, data);
			return flushRequests().then(() => promise);
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

			return flushRequests().then(() => {
				expect(server.error).toBe(null);
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
			return getResource('service.model', modelData).then(model => {
				return client.getResource('service.model').then(modelSecond => {
					expect(model).toBe(modelSecond);

					let req = server.getNextRequest();
					expect(req).toBe(undefined);
				});
			});
		});

		it('unsubscribes model not listened too, removing it from cache', () => {
			return getResource('service.model', modelData).then(model => {
				// Cause unsubscribe by waiting
				return waitAWhile().then(flushRequests).then(() => {
					expect(server.error).toBe(null);
					let req = server.getNextRequest();
					expect(req).not.toBe(undefined);
					expect(req.method).toBe('unsubscribe.service.model');
					server.sendResponse(req, null);

					// Wait for the unsubscribe response
					return flushRequests().then(() => {
						expect(server.error).toBe(null);

						return getResource('service.model', modelData).then(modelSecond => {
							expect(model).not.toBe(modelSecond);

							let req = server.getNextRequest();
							expect(req).toBe(undefined);
						});
					});
				});
			});
		});
	});

	describe('getResource collection', () => {
		it('gets collection resource from server', () => {
			let promise = client.getResource('service.collection').then(collection => {
				expect(server.error).toBe(null);
				expect(server.pendingRequests()).toBe(0);

				expect(collection.length).toBe(3);
				expect(collection.atIndex(0).name).toBe("Ten");
				expect(collection.atIndex(1).name).toBe("Twenty");
				expect(collection.atIndex(2).name).toBe("Thirty");
			});

			return flushRequests().then(() => {
				let req = server.getNextRequest();
				expect(req).not.toBe(undefined);
				expect(req.method).toBe('subscribe.service.collection');
				server.sendResponse(req, [
					{ rid: 'service.item.10', data: { id: 10, name: "Ten" }},
					{ rid: 'service.item.20', data: { id: 20, name: "Twenty" }},
					{ rid: 'service.item.30', data: { id: 30, name: "Thirty" }}
				]);

				return flushRequests().then(() => promise);
			});
		});

		it('gets collection resource from cache on second request', () => {});

		it('unsubscribes collection and its models not listened too, removing it from cache', () => {});

		it('subscribes to listened models before unsubscribing to the collection', () => {});

		it('gets collection resource including a model already subscribed to', () => {});

		it('unsubscribes to previously subscribed model while included in collection', () => {});
	});


});
