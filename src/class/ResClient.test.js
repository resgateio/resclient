import { Server } from 'mock-socket';
import ResClient from './ResClient.js';
import ResModel from './ResModel.js';
import ResCollection from './ResCollection.js';

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

	sendError(req, code, message, data) {
		let obj = { id: req.id, error: { code, message }};
		if (data) {
			obj.error.data = data;
		}
		let json = JSON.stringify(obj);
		this.send(json);
	}

	sendEvent(rid, event, data) {
		let json = JSON.stringify({ event: rid + '.' + event, data });
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

describe("ResClient", () => {

	let port = 1000;
	let server;
	let client;
	let cb;
	let cb2;
	const modelData = {
		foo: "bar",
		int: 42
	};
	const modelResources = {
		models: {
			"service.model": modelData
		}
	};
	const collectionModels = {
		'service.item.10': { id: 10, name: "Ten" },
		'service.item.20': { id: 20, name: "Twenty" },
		'service.item.30': { id: 30, name: "Thirty" }
	};
	const collectionData = [
		{ rid: 'service.item.10' },
		{ rid: 'service.item.20' },
		{ rid: 'service.item.30' }
	];
	const collectionResources = {
		models: collectionModels,
		collections: {
			'service.collection': collectionData
		}
	};
	const primitiveCollectionData = [
		"foo",
		42,
		true,
		false,
		null
	];
	const primitiveCollectionResources = {
		collections: {
			'service.primitives': primitiveCollectionData
		}
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

	function getServerResource(rid, data, collectionFactory) {
		let promise = client.get(rid, collectionFactory);

		return flushRequests().then(() => {
			expect(server.error).toBe(null);
			let req = server.getNextRequest();
			expect(req).not.toBe(undefined);
			expect(req.method).toBe('subscribe.' + rid);
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
		cb = jest.fn();
		cb2 = jest.fn();
	});

	afterEach(() => {
		server.stop();
	});

	describe("connect", () => {

		it("resolves relative url paths", () => {
			client = new ResClient('/ws');
			// a.href doesn't work the same in jest as in a browser
			// Cannot validate the result
		});

		it("connects on connect", (done) => {
			client.connect();
			jest.runAllTimers();
			expect(server.isConnected()).toBe(true);
			done();
		});

		it("connects on getResource", () => {
			client.get('service.test');

			return flushPromises().then(() => {
				expect(server.isConnected()).toBe(true);
			});
		});

		it("disconnects on disconnect", () => {
			let promise = client.connect().then(() => {
				client.disconnect();
				jest.runAllTimers();
				expect(server.isConnected()).toBe(false);
			});
			jest.runOnlyPendingTimers();
			return promise;
		});
	});

	describe("getResource model", () => {

		it("gets model resource from server", () => {
			let promise = client.get('service.model').then(model => {
				expect(model.foo).toBe("bar");
			});

			return flushRequests().then(() => {
				expect(server.error).toBe(null);
				let req = server.getNextRequest();
				expect(req).not.toBe(undefined);
				expect(req.method).toBe('subscribe.service.model');
				server.sendResponse(req, modelResources);
				jest.runOnlyPendingTimers();
				expect(server.error).toBe(null);
				expect(server.pendingRequests()).toBe(0);

				return promise;
			});
		});

		it("gets model resource from cache on second request", () => {
			return getServerResource('service.model', modelResources).then(model => {
				expect(model.foo).toBe("bar");
				return client.get('service.model').then(modelSecond => {
					expect(model).toBe(modelSecond);

					return flushRequests().then(() => {
						let req = server.getNextRequest();
						expect(req).toBe(undefined);
					});
				});
			});
		});

		it("unsubscribes model not listened to, removing it from cache", () => {
			return getServerResource('service.model', modelResources).then(model => {
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

						return getServerResource('service.model', modelResources).then(modelSecond => {
							expect(model).not.toBe(modelSecond);

							let req = server.getNextRequest();
							expect(req).toBe(undefined);
						});
					});
				});
			});
		});

		it("rejects the promise on error", () => {
			let promise = client.get('service.model');

			return flushRequests().then(() => {
				let req = server.getNextRequest();
				server.sendError(req, 'system.notFound', "Not found");
				jest.runOnlyPendingTimers();
				expect(server.error).toBe(null);
				expect(server.pendingRequests()).toBe(0);

				return expect(promise).rejects.toEqual(expect.objectContaining({
					code: 'system.notFound',
					message: "Not found"
				}));
			});
		});
	});

	describe("getResource collection", () => {

		it("gets primitive collection resource from server", () => {
			let promise = client.get('service.primitives').then(collection => {
				expect(server.error).toBe(null);
				expect(server.pendingRequests()).toBe(0);

				expect(collection.length).toBe(primitiveCollectionData.length);
				expect(collection.atIndex(0)).toBe("foo");
				expect(collection.atIndex(1)).toBe(42);
				expect(collection.atIndex(2)).toBe(true);
				expect(collection.atIndex(3)).toBe(false);
				expect(collection.atIndex(4)).toBe(null);
			});

			return flushRequests().then(() => {
				let req = server.getNextRequest();
				expect(req).not.toBe(undefined);
				expect(req.method).toBe('subscribe.service.primitives');
				server.sendResponse(req, primitiveCollectionResources);

				return flushRequests().then(() => promise);
			});
		});

		it("gets model collection resource from server", () => {
			let promise = client.get('service.collection').then(collection => {
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
				server.sendResponse(req, collectionResources);

				return flushRequests().then(() => promise);
			});
		});

		it("gets model collection resource and collection models from cache on second request", () => {
			return getServerResource('service.collection', collectionResources).then(collection => {
				expect(collection.atIndex(0).name).toBe("Ten");
				return client.get('service.collection').then(collectionSecond => {
					expect(collection).toBe(collectionSecond);

					// Test that collection models are also taken from cache
					return client.get(collectionData[0].rid).then(model => {
						expect(model.name).toBe("Ten");

						return flushRequests().then(() => {
							let req = server.getNextRequest();
							expect(req).toBe(undefined);
						});
					});
				});
			});
		});

		it("gets collection model from cache if already loaded", () => {
			let rid = collectionData[0].rid;
			let models = {};
			models[rid] = collectionModels[rid];
			return getServerResource(rid, { models }).then(model => {
				models = Object.assign({}, collectionModels);
				delete models[rid];
				return getServerResource('service.collection', {
					models,
					collections: {
						'service.collection': collectionData
					}
				}).then(collection => {
					expect(collection.atIndex(0)).toBe(model);
					return flushRequests().then(() => {
						let req = server.getNextRequest();
						expect(req).toBe(undefined);
					});
				});
			});
		});

		it("unsubscribes collection and its models not listened to, removing it from cache", () => {
			return getServerResource('service.collection', collectionResources).then(collection => {
				let model = collection.atIndex(0);

				// Cause unsubscribe by waiting
				return waitAWhile().then(flushRequests).then(() => {
					expect(server.error).toBe(null);
					let req = server.getNextRequest();
					expect(req).not.toBe(undefined);
					expect(req.method).toBe('unsubscribe.service.collection');
					server.sendResponse(req, null);

					// Wait for the unsubscribe response
					return flushRequests().then(() => {
						expect(server.error).toBe(null);

						// Get model again
						let rid = collectionData[0].rid;
						let models = {};
						models[rid] = collectionModels[rid];
						return getServerResource(rid, { models }).then(modelSecond => {
							expect(model).not.toBe(modelSecond);
							// Get collection again
							models = Object.assign({}, collectionModels);
							delete models[rid];
							return getServerResource('service.collection', {
								models,
								collections: {
									'service.collection': collectionData
								}
							}).then(collectionSecond => {
								expect(collection).not.toBe(collectionSecond);
								expect(collectionSecond.atIndex(0)).toBe(modelSecond);

								return flushRequests().then(() => {
									let req = server.getNextRequest();
									expect(req).toBe(undefined);
								});
							});
						});
					});
				});
			});
		});
	});

	describe("model.on", () => {

		it("does not unsubscribe to model being listened to", () => {
			return getServerResource('service.model', modelResources).then(model => {
				model.on('change', cb);

				return waitAWhile().then(flushRequests).then(() => {
					let req = server.getNextRequest();
					expect(req).toBe(undefined);
				});
			});
		});

		it("does not unsubscribe to model being listened to without handler", () => {
			return getServerResource('service.model', modelResources).then(model => {
				model.on();

				return waitAWhile().then(flushRequests).then(() => {
					let req = server.getNextRequest();
					expect(req).toBe(undefined);
				});
			});
		});

		it("unsubscribes to model after it is no longer listened to", () => {
			return getServerResource('service.model', modelResources).then(model => {
				model.on('change', cb);
				model.on('change', cb2);

				return waitAWhile().then(flushRequests).then(() => {
					model.off('change', cb);

					return waitAWhile().then(flushRequests).then(() => {
						expect(server.pendingRequests()).toBe(0);
						model.off('change', cb2);

						return waitAWhile().then(flushRequests).then(() => {
							expect(server.error).toBe(null);
							let req = server.getNextRequest();
							expect(req).not.toBe(undefined);
							expect(req.method).toBe('unsubscribe.service.model');
							server.sendResponse(req, null);

							// Wait for the unsubscribe response
							return flushRequests().then(() => {
								expect(server.error).toBe(null);

								return getServerResource('service.model', modelResources).then(modelSecond => {
									expect(model).not.toBe(modelSecond);
									expect(server.pendingRequests()).toBe(0);
								});
							});
						});
					});
				});
			});
		});

		it("unsubscribes to model after it is no longer listened to without handler", () => {
			return getServerResource('service.model', modelResources).then(model => {
				model.on();

				return waitAWhile().then(flushRequests).then(() => {
					expect(server.pendingRequests()).toBe(0);
					model.off();

					return waitAWhile().then(flushRequests).then(() => {
						expect(server.error).toBe(null);
						let req = server.getNextRequest();
						expect(req).not.toBe(undefined);
						expect(req.method).toBe('unsubscribe.service.model');
						server.sendResponse(req, null);

						// Wait for the unsubscribe response
						return flushRequests().then(() => {
							expect(server.error).toBe(null);
						});
					});
				});
			});
		});

		it("does not unsubscribe to model re-listened to before unsubscribe delay", () => {
			return getServerResource('service.model', modelResources).then(model => {
				model.on('change', cb);

				return waitAWhile().then(flushRequests).then(() => {
					model.off('change', cb);

					return waitAWhile(1000).then(flushRequests).then(() => {
						model.on('change', cb2);

						return waitAWhile().then(flushRequests).then(() => {
							expect(server.pendingRequests()).toBe(0);
						});
					});
				});
			});
		});

		it("emits a change event on change", () => {
			return getServerResource('service.model', modelResources).then(model => {
				model.on('change', cb);

				server.sendEvent('service.model', 'change', { values: { foo: 'baz' }});
				return flushRequests().then(() => {
					expect(cb.mock.calls.length).toBe(1);
					expect(cb.mock.calls[0][0]).toEqual({ foo: 'bar' });
					expect(cb.mock.calls[0][1]).toBe(model);
					expect(model.foo).toBe('baz');

					let req = server.getNextRequest();
					expect(req).toBe(undefined);
				});
			});
		});

		it("emits a custom event", () => {
			return getServerResource('service.model', modelResources).then(model => {
				model.on('custom', cb);

				server.sendEvent('service.model', 'custom', { foo: 'baz' });
				return flushRequests().then(() => {
					expect(cb.mock.calls.length).toBe(1);
					expect(cb.mock.calls[0][0]).toEqual({ foo: 'baz' });
					expect(cb.mock.calls[0][1]).toBe(model);
					expect(model.foo).toBe('bar');

					let req = server.getNextRequest();
					expect(req).toBe(undefined);
				});
			});
		});

		it("emits an event received before unsubscribe response", () => {
			return getServerResource('service.model', modelResources).then(model => {
				// Cause unsubscribe by waiting
				return waitAWhile().then(flushRequests).then(() => {
					let req = server.getNextRequest();
					server.sendEvent('service.model', 'custom', { foo: 'baz' });
					server.sendResponse(req, null);

					// Wait for the unsubscribe response
					return flushRequests().then(() => {
						expect(server.error).toBe(null);

						return getServerResource('service.model', modelResources).then(modelSecond => {
							expect(model).not.toBe(modelSecond);

							let req = server.getNextRequest();
							expect(req).toBe(undefined);
						});
					});
				});
			});
		});

		it("tries to resubscribes a while after unsubscribe event", () => {
			return getServerResource('service.model', modelResources).then(model => {
				model.on('unsubscribe', cb);

				server.sendEvent('service.model', 'unsubscribe');
				return flushRequests().then(() => {
					expect(server.pendingRequests()).toBe(0);
					expect(cb.mock.calls.length).toBe(1);

					return waitAWhile().then(flushRequests()).then(() => {
						expect(server.error).toBe(null);
						expect(server.pendingRequests()).toBe(1);
						let req = server.getNextRequest();
						expect(req.method).toBe('subscribe.service.model');
					});
				});
			});
		});

		it("instantly removes stale item from cache when no longer listened to", () => {
			return getServerResource('service.model', modelResources).then(model => {
				model.on('custom', cb);

				server.sendEvent('service.model', 'unsubscribe');
				return flushRequests().then(() => {
					model.off('custom', cb);

					return getServerResource('service.model', modelResources).then(modelSecond => {
						expect(model).not.toBe(modelSecond);
					});
				});
			});
		});

		it("instantly resubscribes to a model when listening between an unsubscribe request and its response", () => {
			// TODO
		});
	});

	describe("collection.on", () => {

		it("does not unsubscribe to collection being listened to", () => {
			return getServerResource('service.collection', collectionResources).then(collection => {
				collection.on('add', cb);

				return waitAWhile().then(flushRequests).then(() => {
					let req = server.getNextRequest();
					expect(req).toBe(undefined);
				});
			});
		});

		it("unsubscribes to collection after it is no longer listened to", () => {
			return getServerResource('service.collection', collectionResources).then(collection => {
				collection.on('add', cb);
				collection.on('remove', cb2);

				return waitAWhile().then(flushRequests).then(() => {
					collection.off('add', cb);

					return waitAWhile().then(flushRequests).then(() => {
						expect(server.pendingRequests()).toBe(0);
						collection.off('remove', cb2);

						return waitAWhile().then(flushRequests).then(() => {
							expect(server.error).toBe(null);
							let req = server.getNextRequest();
							expect(req).not.toBe(undefined);
							expect(req.method).toBe('unsubscribe.service.collection');
							server.sendResponse(req, null);

							// Wait for the unsubscribe response
							return flushRequests().then(() => {
								expect(server.error).toBe(null);

								return getServerResource('service.collection', collectionResources).then(collectionSecond => {
									expect(collection).not.toBe(collectionSecond);
									expect(server.pendingRequests()).toBe(0);
								});
							});
						});
					});
				});
			});
		});

		it("subscribes to listened models before unsubscribing to the collection", () => {
			return getServerResource('service.collection', collectionResources).then(collection => {
				let model = collection.atIndex(0);
				model.on('change', cb);

				// Cause unsubscribe by waiting
				return waitAWhile().then(flushRequests).then(() => {
					expect(server.error).toBe(null);
					let subReq = server.getNextRequest();
					expect(subReq).not.toBe(undefined);
					expect(subReq.method).toBe('subscribe.' + collectionData[0].rid);
					server.sendResponse(subReq, null);

					let unsubReq = server.getNextRequest();
					expect(unsubReq).not.toBe(undefined);
					expect(unsubReq.method).toBe('unsubscribe.service.collection');
					server.sendResponse(unsubReq, null);

					// Wait for the subscribe and unsubscribe response
					return flushRequests().then(() => {
						expect(server.error).toBe(null);

						// Get model from cache
						return client.get(collectionData[0].rid).then(modelSecond => {
							expect(model).toBe(modelSecond);

							return flushRequests().then(() => {
								let req = server.getNextRequest();
								expect(req).toBe(undefined);
							});
						});
					});
				});
			});
		});

		it("unsubscribes to previously subscribed model while included in collection", () => {
			// Get model
			let rid = collectionData[0].rid;
			let models = {};
			models[rid] = collectionModels[rid];
			return getServerResource(rid, { models }).then(model => {
				// Get collection
				models = Object.assign({}, collectionModels);
				delete models[rid];
				return getServerResource('service.collection', {
					models,
					collections: {
						'service.collection': collectionData
					}
				}).then(collection => {
					expect(collection.atIndex(0)).toBe(model);

					return waitAWhile().then(flushRequests).then(() => {
						expect(server.error).toBe(null);
						let modelOrCollection = [ 'unsubscribe.service.collection', 'unsubscribe.' + collectionData[0].rid ];

						let req1 = server.getNextRequest();
						expect(req1).not.toBe(undefined);
						expect(modelOrCollection).toContain(req1.method);
						server.sendResponse(req1, null);

						let req2 = server.getNextRequest();
						expect(req2).not.toBe(undefined);
						expect(modelOrCollection).toContain(req2.method);
						server.sendResponse(req2, null);

						expect(req1.method).not.toBe(req2.method);

						let req = server.getNextRequest();
						expect(req).toBe(undefined);
					});
				});
			});
		});

		it("emits an add event on model add", () => {
			return getServerResource('service.collection', collectionResources).then(collection => {
				collection.on('add', cb);

				server.sendEvent('service.collection', 'add', { value: { rid: 'service.item.35' }, models: { 'service.item.35': { id: 35, name: "Thirtyfive" }}, idx: 3 });
				server.sendEvent('service.collection', 'add', { value: { rid: 'service.item.15' }, models: { 'service.item.15': { id: 15, name: "Fifteen" }}, idx: 1 });
				server.sendEvent('service.collection', 'add', { value: { rid: 'service.item.5' }, models: { 'service.item.5': { id: 5, name: "Five" }}, idx: 0 });

				return flushRequests().then(() => {
					expect(cb.mock.calls.length).toBe(3);
					expect(cb.mock.calls[0][0]).toEqual({ idx: 3, item: collection.atIndex(5) });
					expect(cb.mock.calls[0][1]).toBe(collection);
					expect(cb.mock.calls[1][0]).toEqual({ idx: 1, item: collection.atIndex(2) });
					expect(cb.mock.calls[1][1]).toBe(collection);
					expect(cb.mock.calls[2][0]).toEqual({ idx: 0, item: collection.atIndex(0) });
					expect(cb.mock.calls[2][1]).toBe(collection);

					expect(collection.length).toBe(6);
					expect(collection.atIndex(0).name).toBe("Five");
					expect(collection.atIndex(1).name).toBe("Ten");
					expect(collection.atIndex(2).name).toBe("Fifteen");
					expect(collection.atIndex(3).name).toBe("Twenty");
					expect(collection.atIndex(4).name).toBe("Thirty");
					expect(collection.atIndex(5).name).toBe("Thirtyfive");

					let req = server.getNextRequest();
					expect(req).toBe(undefined);
				});
			});
		});

		it("emits a remove event on model remove", () => {
			return getServerResource('service.collection', {
				collections: {
					'service.collection': [
						collectionData[0],
						{ rid: 'service.item.15' },
						collectionData[1],
						{ rid: 'service.item.25' },
						collectionData[2]
					]
				},
				models: {
					'service.item.10': collectionModels['service.item.10'],
					'service.item.15': { id: 15, name: "Fifteen" },
					'service.item.20': collectionModels['service.item.20'],
					'service.item.25': { id: 25, name: "Twentyfive" },
					'service.item.30': collectionModels['service.item.30']
				}
			}).then(collection => {
				collection.on('remove', cb);

				let model10 = collection.atIndex(0);
				let model20 = collection.atIndex(2);
				let model30 = collection.atIndex(4);

				server.sendEvent('service.collection', 'remove', { idx: 0 });
				server.sendEvent('service.collection', 'remove', { idx: 1 });
				server.sendEvent('service.collection', 'remove', { idx: 2 });

				return flushRequests().then(() => {
					expect(cb.mock.calls.length).toBe(3);
					expect(cb.mock.calls[0][0]).toEqual({ idx: 0, item: model10 });
					expect(cb.mock.calls[0][1]).toBe(collection);
					expect(cb.mock.calls[1][0]).toEqual({ idx: 1, item: model20 });
					expect(cb.mock.calls[1][1]).toBe(collection);
					expect(cb.mock.calls[2][0]).toEqual({ idx: 2, item: model30 });
					expect(cb.mock.calls[2][1]).toBe(collection);

					expect(collection.length).toBe(2);
					expect(collection.atIndex(0).name).toBe("Fifteen");
					expect(collection.atIndex(1).name).toBe("Twentyfive");

					let req = server.getNextRequest();
					expect(req).toBe(undefined);
				});
			});
		});

		it("emits an add event on primitive add", () => {
			return getServerResource('service.primitives', primitiveCollectionResources).then(collection => {
				collection.on('add', cb);

				server.sendEvent('service.primitives', 'add', { value: "bar", idx: 0 });
				server.sendEvent('service.primitives', 'add', { value: 52, idx: 3 });
				server.sendEvent('service.primitives', 'add', { value: "end", idx: 7 });

				return flushRequests().then(() => {
					expect(cb.mock.calls.length).toBe(3);
					expect(cb.mock.calls[0][0]).toEqual({ idx: 0, item: "bar" });
					expect(cb.mock.calls[0][1]).toBe(collection);
					expect(cb.mock.calls[1][0]).toEqual({ idx: 3, item: 52 });
					expect(cb.mock.calls[1][1]).toBe(collection);
					expect(cb.mock.calls[2][0]).toEqual({ idx: 7, item: "end" });
					expect(cb.mock.calls[2][1]).toBe(collection);

					expect(collection.length).toBe(8);
					expect(collection.atIndex(0)).toBe("bar");
					expect(collection.atIndex(1)).toBe("foo");
					expect(collection.atIndex(2)).toBe(42);
					expect(collection.atIndex(3)).toBe(52);
					expect(collection.atIndex(4)).toBe(true);
					expect(collection.atIndex(5)).toBe(false);
					expect(collection.atIndex(6)).toBe(null);
					expect(collection.atIndex(7)).toBe("end");

					let req = server.getNextRequest();
					expect(req).toBe(undefined);
				});
			});
		});

		it("emits a remove event on primitive remove", () => {
			return getServerResource('service.primitives', primitiveCollectionResources).then(collection => {
				collection.on('remove', cb);

				let item0 = collection.atIndex(0);
				let item1 = collection.atIndex(2);
				let item2 = collection.atIndex(4);

				server.sendEvent('service.primitives', 'remove', { idx: 0 });
				server.sendEvent('service.primitives', 'remove', { idx: 1 });
				server.sendEvent('service.primitives', 'remove', { idx: 2 });

				return flushRequests().then(() => {
					expect(cb.mock.calls.length).toBe(3);
					expect(cb.mock.calls[0][0]).toEqual({ idx: 0, item: item0 });
					expect(cb.mock.calls[0][1]).toBe(collection);
					expect(cb.mock.calls[1][0]).toEqual({ idx: 1, item: item1 });
					expect(cb.mock.calls[1][1]).toBe(collection);
					expect(cb.mock.calls[2][0]).toEqual({ idx: 2, item: item2 });
					expect(cb.mock.calls[2][1]).toBe(collection);

					expect(collection.length).toBe(2);
					expect(collection.atIndex(0)).toBe(42);
					expect(collection.atIndex(1)).toBe(false);

					let req = server.getNextRequest();
					expect(req).toBe(undefined);
				});
			});
		});

		it("sets a listened model as stale when removed, subscribing to it after a while", () => {
			return getServerResource('service.collection', collectionResources).then(collection => {
				let model = collection.atIndex(0);
				collection.on('remove', cb);
				model.on('change', cb2);
				server.sendEvent('service.collection', 'remove', { idx: 0 });

				return flushRequests().then(() => {
					expect(cb.mock.calls.length).toBe(1);
					expect(collection.length).toBe(2);

					expect(cb.mock.calls[0][0]).toEqual({ idx: 0, item: model });
					expect(cb.mock.calls[0][1]).toBe(collection);

					expect(server.pendingRequests()).toBe(0);

					return waitAWhile().then(flushRequests).then(() => {
						let req = server.getNextRequest();
						expect(req).not.toBe(undefined);
						expect(req.method).toBe('subscribe.' + collectionData[0].rid);
						server.sendResponse(req, { models: {
							'service.item.10': {
								id: 10,
								name: "X"
							}
						}});

						return flushRequests().then(() => {
							expect(cb2.mock.calls.length).toBe(1);
							expect(cb2.mock.calls[0][0]).toEqual({ name: "Ten" });
							expect(cb2.mock.calls[0][1]).toBe(model);
							expect(model.name).toBe("X");

							expect(server.error).toBe(null);
							expect(server.pendingRequests()).toBe(0);
						});
					});
				});
			});
		});
	});

	describe("reconnect", () => {

		it("reconnects after connection is lost", () => {
			let promise = client.connect()
				.then(() => {
					let oldUrl = server.url;
					expect(server.isConnected()).toBe(true);
					server.close();
					return flushPromises().then(() => {
						server = new ResServer(oldUrl);
						expect(server.isConnected()).toBe(false);

						return waitAWhile().then(flushPromises).then(() => {
							expect(server.isConnected()).toBe(true);
						});
					});
				});
			return flushRequests().then(() => promise);
		});

		it("resubscribes to a model after reconnect", () => {
			return getServerResource('service.model', modelResources).then(model => {
				model.on('change', cb);
				let oldUrl = server.url;
				server.close();

				return flushPromises().then(() => {
					server = new ResServer(oldUrl);

					return waitAWhile().then(flushRequests).then(() => {
						expect(server.error).toBe(null);
						let req = server.getNextRequest();
						expect(req).not.toBe(undefined);
						expect(req.method).toBe('subscribe.service.model');
						server.sendResponse(req, modelResources);

						return flushRequests().then(() => {
							expect(server.error).toBe(null);
							expect(server.pendingRequests()).toBe(0);
						});
					});
				});
			});
		});

		it("emits a change event when resubscribed model differs from cached model", () => {
			return getServerResource('service.model', modelResources).then(model => {
				model.on('change', cb);
				let oldUrl = server.url;
				server.close();

				return flushPromises().then(() => {
					server = new ResServer(oldUrl);

					return waitAWhile().then(flushRequests).then(() => {
						let req = server.getNextRequest();
						server.sendResponse(req, { models: {
							'service.model': {
								foo: "baz",
								int: 42
							}
						}});

						return flushRequests().then(() => {
							expect(cb.mock.calls.length).toBe(1);
							expect(cb.mock.calls[0][0]).toEqual({ foo: 'bar' });
							expect(cb.mock.calls[0][1]).toBe(model);
							expect(model.foo).toBe('baz');

							expect(server.error).toBe(null);
							expect(server.pendingRequests()).toBe(0);
						});
					});
				});
			});
		});

		it("emits remove and add events when collection differs from cached collection", () => {
			return getServerResource('service.collection', collectionResources).then(collection => {
				let oldUrl = server.url;
				collection.on('remove', cb);
				collection.on('add', cb2);
				server.close();

				return flushPromises().then(() => {
					server = new ResServer(oldUrl);

					return waitAWhile().then(flushRequests).then(() => {
						let req = server.getNextRequest();
						server.sendResponse(req, {
							models: {
								'service.item.15': { id: 15, name: "Fifteen" }
							},
							collections: {
								'service.collection': [
									collectionData[0],
									{ rid: 'service.item.15' },
									collectionData[2],
									"foo"
								]
							}
						});

						return flushRequests().then(() => {
							expect(collection.length).toBe(4);
							expect(cb.mock.calls.length).toBe(1);
							expect(cb.mock.calls[0][1]).toBe(collection);
							expect(cb.mock.calls[0][0].item.getResourceId()).toBe('service.item.20');
							expect(cb.mock.calls[0][0].idx).toEqual(1);
							expect(cb2.mock.calls.length).toBe(2);
							expect(cb2.mock.calls[0][1]).toBe(collection);
							expect(cb2.mock.calls[0][0].item.getResourceId()).toBe('service.item.15');
							expect(cb2.mock.calls[0][0].idx).toEqual(1);
							expect(cb2.mock.calls[1][1]).toBe(collection);
							expect(cb2.mock.calls[1][0].item).toEqual("foo");
							expect(cb2.mock.calls[1][0].idx).toEqual(3);

							expect(server.error).toBe(null);
							expect(server.pendingRequests()).toBe(0);
						});
					});
				});
			});
		});
	});

	describe("setOnConnect", () => {

		it("calls the setOnConnect callback after connect", () => {
			client.setOnConnect(cb);
			client.connect();
			jest.runAllTimers();
			expect(cb.mock.calls.length).toBe(1);
		});

		it("postpones any request until setOnConnect callback resolves", () => {
			let onConnect = jest.fn(() => client.call('service.model', 'test'));
			client.setOnConnect(onConnect);

			let promise = client.get('service.model');

			return flushRequests().then(() => {
				expect(server.pendingRequests()).toBe(1);
				expect(server.error).toBe(null);
				let req = server.getNextRequest();
				expect(req.method).toBe('call.service.model.test');
				server.sendResponse(req, null);

				return flushRequests().then(() => {

					expect(server.error).toBe(null);
					let req = server.getNextRequest();
					expect(req).not.toBe(undefined);
					expect(req.method).toBe('subscribe.service.model');
					server.sendResponse(req, modelData);
					jest.runOnlyPendingTimers();
					expect(server.error).toBe(null);
					expect(server.pendingRequests()).toBe(0);
					return promise;
				});
			});
		});
	});

	describe("modelType", () => {

		it("uses the registered model type when creating a model instance", () => {
			client.registerModelType(
				'service.item.*',
				(api, rid, data) => {
					return new ResModel(api, rid, {
						definition: {
							id: { type: 'number' },
							name: { type: 'string' },
							flag: { type: 'boolean', default: true }
						}
					});
				}
			);

			return getServerResource('service.collection', collectionResources).then(collection => {
				expect(collection.atIndex(0).flag).toBe(true);
				expect(collection.atIndex(1).flag).toBe(true);
				expect(collection.atIndex(1).flag).toBe(true);
			});
		});

		// it("does not use an unregistered model type when creating a model instance", () => {
		// 	client.registerModelType(
		// 		'service.item.*',
		// 		(api, rid, data) => {
		// 			return new ResModel(api, rid, {
		// 				definition: {
		// 					id: { type: 'number' },
		// 					name: { type: 'string' },
		// 					flag: { type: 'boolean', default: true }
		// 				}
		// 			});
		// 		}
		// 	);

		// 	client.unregisterModelType('service.item');

		// 	return getServerResource('service.collection', collectionResources).then(collection => {
		// 		expect(collection.atIndex(0).flag).toBe(undefined);
		// 		expect(collection.atIndex(1).flag).toBe(undefined);
		// 		expect(collection.atIndex(1).flag).toBe(undefined);
		// 	});
		// });

		it("uses the registered collection type when creating a collection instance", () => {
			client.registerCollectionType(
				'service.collection',
				(api, rid) => {
					let c = new ResCollection(api, rid);
					c.flag = true;
					return c;
				}
			);

			return getServerResource('service.collection', collectionResources).then(collection => {
				expect(collection.flag).toBe(true);
			});
		});
	});

	describe("ResModel", () => {

		it("calls remote method on call with parameters", () => {
			return getServerResource('service.model', modelResources).then(model => {
				model.call('test', { zoo: "baz", value: 12 });

				return flushRequests().then(() => {
					expect(server.pendingRequests()).toBe(1);
					expect(server.error).toBe(null);
					let req = server.getNextRequest();
					expect(req.method).toBe('call.service.model.test');
					expect(req.params).toEqual({ zoo: "baz", value: 12 });
				});
			});
		});

		it("calls remote method on call without parameters", () => {
			return getServerResource('service.model', modelResources).then(model => {
				model.call('test');
				return flushRequests().then(() => {
					let req = server.getNextRequest();
					expect([ null, undefined ]).toContain(req.params);
				});
			});
		});

		it("calls set method on set", () => {
			return getServerResource('service.model', modelResources).then(model => {
				model.set({ foo: "baz" });
				return flushRequests().then(() => {
					let req = server.getNextRequest();
					expect(req.method).toBe('call.service.model.set');
					expect(req.params).toEqual({ foo: "baz" });
				});
			});
		});

		it("resolves call promise on success", () => {
			return getServerResource('service.model', modelResources).then(model => {
				let promise = model.call('test');

				return flushRequests().then(() => {
					let req = server.getNextRequest();
					server.sendResponse(req, { responseValue: true });

					return flushRequests().then(() => {
						return expect(promise).resolves.toEqual({ responseValue: true });
					});
				});
			});
		});

		it("rejects call promise on error", () => {
			return getServerResource('service.model', modelResources).then(model => {
				let promise = model.call('test');

				return flushRequests().then(() => {
					let req = server.getNextRequest();
					expect(req).not.toBe(undefined);
					server.sendError(req, 'service.testError', "Test error");

					return expect(promise).rejects.toEqual(expect.objectContaining({
						code: 'service.testError',
						message: "Test error"
					}));
				});
			});
		});

		it("creates anonymous object on toJSON", () => {
			return getServerResource('service.model', modelResources).then(model => {
				expect(model.toJSON()).toEqual(modelData);
			});
		});

		it("creates anonymous object on toJSON using definition", () => {
			client.registerModelType(
				'service.model',
				(api, rid) => {
					return new ResModel(api, rid, {
						definition: {
							foo: { type: 'string' },
							value: { type: 'number', default: 10 },
							notProvided: { type: 'string', default: "Not provided" }
						}
					});
				}
			);

			return getServerResource('service.model', { models: {
				'service.model': {
					foo: "bar",
					value: 12,
					notDefined: "Not defined"
				}
			}}).then(model => {
				expect(model.toJSON()).toEqual({
					foo: "bar",
					value: 12,
					notProvided: "Not provided"
				});
			});
		});
	});

	describe("ResCollection", () => {

		it("getResourceId returns the collection resource ID", () => {
			return getServerResource('service.collection', collectionResources).then(collection => {
				expect(collection.getResourceId()).toBe('service.collection');
			});
		});

		it("getResourceId returns the collection resource ID", () => {
			return getServerResource('service.collection', collectionResources).then(collection => {
				expect(collection.getResourceId()).toBe('service.collection');
			});
		});

		it("length gets the collection length", () => {
			return getServerResource('service.collection', collectionResources).then(collection => {
				expect(collection.length).toBe(3);
			});
		});

		it("get returns the model using ID with idAttribute set", () => {
			client.registerCollectionType(
				'service.collection',
				(api, rid) => new ResCollection(api, rid, {
					idCallback: m => m.id
				})
			);

			return getServerResource('service.collection', collectionResources).then(collection => {
				expect(collection.get(10).toJSON()).toEqual({ id: 10, name: "Ten" });
				expect(collection.get(20).toJSON()).toEqual({ id: 20, name: "Twenty" });
				expect(collection.get(30).toJSON()).toEqual({ id: 30, name: "Thirty" });
			});
		});

		it("atIndex gets the item at a given index", () => {
			return getServerResource('service.collection', collectionResources).then(collection => {
				expect(collection.atIndex(0).toJSON()).toEqual({ id: 10, name: "Ten" });
				expect(collection.atIndex(1).toJSON()).toEqual({ id: 20, name: "Twenty" });
				expect(collection.atIndex(2).toJSON()).toEqual({ id: 30, name: "Thirty" });
			});
		});

		it("indexOf gets the index of a primitive item", () => {
			return getServerResource('service.collection', { collections: {
				'service.collection': [
					"Foo",
					"Bar",
					"Baz",
					"Bar"
				]
			}}).then(collection => {
				expect(collection.indexOf("Foo")).toBe(0);
				expect(collection.indexOf("Bar")).toBe(1);
				expect(collection.indexOf("Baz")).toBe(2);
				expect(collection.indexOf("Faz")).toBe(-1);
			});
		});

		it("indexOf gets the index of a model item", () => {
			return getServerResource('service.collection', collectionResources).then(collection => {
				expect(collection.indexOf(collection.atIndex(0))).toBe(0);
				expect(collection.indexOf(collection.atIndex(1))).toBe(1);
				expect(collection.indexOf(collection.atIndex(2))).toBe(2);
				expect(collection.indexOf({})).toBe(-1);
			});
		});

		it("implements iterable", () => {
			return getServerResource('service.collection', collectionResources).then(collection => {
				let i = 0;
				for (let model of collection) {
					let expModel = collectionModels[collectionData[i].rid];
					expect(model.id).toBe(expModel.id);
					expect(model.name).toBe(expModel.name);
					i++;
				}
			});
		});

		it("creates anonymous array on toJSON", () => {
			return getServerResource('service.collection', collectionResources).then(collection => {
				expect(collection.toJSON()).toEqual([
					{ id: 10, name: "Ten" },
					{ id: 20, name: "Twenty" },
					{ id: 30, name: "Thirty" }
				]);
			});
		});
	});

});
