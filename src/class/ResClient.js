import CacheItem from './CacheItem';
import ResCollection from './ResCollection';
import ResModel from './ResModel';
import eventBus from 'modapp/eventBus';
import * as obj from 'modapp-utils/obj';
import { ResError } from './resError';

const defaultModelType = {
	id: null,
	modelFactory: function(api, rid, data) {
		return new ResModel(api, rid, data);
	}
};

const defaultCollectionFactory = function(api, rid, data) {
	return new ResCollection(api, rid, data);
};

const defaultNamespace = 'resclient';
const reconnectDelay = 3000;
const subscribeStaleDelay = 2000;

/**
 * ResClient is a client implementing the RES-Client protocol.
 */
class ResClient {

	/**
	 * Creates a ResClient instance
	 * @param {string} hostUrl Websocket host path. May be relative to current path.
	 * @param {object} [opt] Optional parameters.
	 * @param {function} [opt.onConnect] On connect callback called prior resolving the connect promise and subscribing to stale resources. May return a promise.
	 * @param {string} [opt.namespace] Event bus namespace. Defaults to 'resclient'.
	 * @param {module:modapp/ext~EventBus} [opt.eventBus] Event bus.
	 */
	constructor(hostUrl, opt) {
		this.hostUrl = this._resolvePath(hostUrl);
		obj.update(this, opt, {
			onConnect: { type: '?function' },
			namespace: { type: 'string', default: defaultNamespace },
			eventBus: { type: 'object', default: eventBus }
		});

		this.tryConnect = false;
		this.connected = false;
		this.ws = null;
		this.requests = {};
		this.reqId = 1; // Incremental request id
		this.cache = {};
		this.modelTypes = {};
		this.stale = null;

		// Queue promises
		this.connectPromise = null;
		this.connectCallback = null;

		// Bind callbacks
		this._handleOnopen = this._handleOnopen.bind(this);
		this._handleOnerror = this._handleOnerror.bind(this);
		this._handleOnmessage = this._handleOnmessage.bind(this);
		this._handleOnclose = this._handleOnclose.bind(this);
		this._unsubscribeCacheItem = this._unsubscribeCacheItem.bind(this);
	}

	/**
	 * Connects the instance to the server.
	 * Can be called even if a connection is already established.
	 * @returns {Promise} A promise to the established connection.
	 */
	connect() {
		this.tryConnect = true;

		return this.connectPromise = this.connectPromise || new Promise((resolve, reject) => {
			this.connectCallback = { resolve, reject };
			this.ws = new WebSocket(this.hostUrl);

			this.ws.onopen = this._handleOnopen;
			this.ws.onerror = this._handleOnerror;
			this.ws.onmessage = this._handleOnmessage;
			this.ws.onclose = this._handleOnclose;
		});
	}

	/**
	 * Disconnects any current connection and stops attempts
	 * of reconnecting.
	 */
	disconnect() {
		this.tryConnect = false;

		if (this.ws) {
			this.ws.close();
			this._connectReject(new Error("Disconnect called"));
		}
	}

	/**
	 * Attach an  event handler function for one or more instance events.
	 * @param {?string} events One or more space-separated events. Null means any event.
	 * @param {eventCallback} handler A function to execute when the event is emitted.
	 */
	on(events, handler) {
		this.eventBus.on(this, events, handler, this.namespace);
	}

	 /**
	 * Remove an instance event handler.
	 * @param {?string} events One or more space-separated events. Null means any event.
	 * @param {eventCallback} [handler] An optional handler function. The handler will only be remove if it is the same handler.
	 */
	off(events, handler) {
		this.eventBus.off(this, events, handler, this.namespace);
	}

	/**
	 * Sets the onConnect callback.
	 * @param {?function} onConnect On connect callback called prior resolving the connect promise and subscribing to stale resources. May return a promise.
	 * @returns {this}
	 */
	setOnConnect(onConnect) {
		this.onConnect = onConnect;
		return this;
	}

	/**
	 * Sends a JsonRpc call to the server
	 * @param {object} method Method name
	 * @param {object} params Method parameters
	 * @returns {Promise.<object>} Promise to the response
	 * @private
	 */
	_send(method, params) {
		return this.connected
			? this._sendNow(method, params)
			: this.connect().then(() => this._sendNow(method, params));
	}

	_sendNow(method, params) {
		return new Promise((resolve, reject) => {
			// Prepare request object
			var req = { id: this.reqId++, method: method, params: params || undefined };

			this.requests[req.id] = {
				method: method,
				params: req.params,
				resolve: resolve,
				reject: reject
			};

			var json = JSON.stringify(req);
			this.ws.send(json);
		});
	}

	/**
	 * Recieves a incoming json encoded data string and executes the appropriate functions/callbacks.
	 * @param {string} json Json encoded data
	 * @private
	 */
	_receive(json) {
		let data = JSON.parse(json.trim());

		if (data.hasOwnProperty('id')) {

			// Find the stored request
			let req = this.requests[data.id];
			if (!req) {
				throw new Error("Server response without matching request");
			}

			delete this.requests[data.id];

			if (data.hasOwnProperty("error")) {
				this._handleErrorResponse(req, data);
			} else {
				this._handleSuccessResponse(req, data);
			}
		} else if (data.hasOwnProperty('event')) {
			this._handleEvent(data);
		} else {
			throw new Error("Invalid message from server: " + json);
		}
	}

	_handleErrorResponse(req, data) {
		let err = new ResError(
			data.error.code,
			data.error.message,
			data.error.data,
			req.method,
			req.params
		);
		try {
			this._emit('error', err);
		} catch (ex) {}

		// Execute error callback bound to calling object
		req.reject(err);
	}

	_handleSuccessResponse(req, data) {
		// Execute success callback bound to calling object
		req.resolve(data.result);
	}

	_handleEvent(data) {
		// Event
		let idx = data.event.lastIndexOf('.');
		if (idx < 0 || idx === data.event.length - 1) {
			throw new Error("Malformed event name: " + data.event);
		}

		let rid = data.event.substr(0, idx);

		let cacheItem = this.cache[rid];
		if (!cacheItem) {
			throw new Error("Resource not found in cache");
		}

		let event = data.event.substr(idx + 1);

		switch (event) {
			case 'change':
				this._handleChangeEvent(rid, cacheItem, event, data.data);
				break;

			case 'add':
				this._handleAddEvent(rid, cacheItem, event, data.data);
				break;

			case 'remove':
				this._handleRemoveEvent(rid, cacheItem, event, data.data);
				break;

			case 'unsubscribe':
				this._handleUnsubscribeEvent(rid, cacheItem, event);
				break;

			default:
				this.eventBus.emit(cacheItem.item, this.namespace + '.resource.' + rid + '.' + event, data.data);
				break;
		}
	}

	_handleChangeEvent(rid, cacheItem, event, data) {
		if (cacheItem.type.change) {
			cacheItem.type.change(cacheItem.item, data);
		} else {
			// Default behaviour
			let changed = cacheItem.item.__update(data);
			if (changed) {
				this.eventBus.emit(cacheItem.item, this.namespace + '.resource.' + rid + '.' + event, changed);
			}
		}
	}

	_handleAddEvent(rid, cacheItem, event, data) {
		if (!cacheItem.isCollection) {
			throw new Error("Add event on model");
		}

		let modelId = data.rid;
		let cacheModel = this._getCachedModel(modelId, data.data, true);
		let idx = cacheItem.item.__add(modelId, cacheModel.item, data.idx);
		this.eventBus.emit(cacheItem.item, this.namespace + '.resource.' + rid + '.' + event, { item: cacheModel.item, idx });
	}

	_handleRemoveEvent(rid, cacheItem, event, data) {
		if (!cacheItem.isCollection) {
			throw new Error("Remove event on model");
		}

		let modelId = data.rid;
		let cacheModel = this.cache[modelId];
		if (!cacheModel) {
			throw new Error("Removed model is not in cache");
		}

		let idx = cacheItem.item.__remove(modelId);
		this.eventBus.emit(cacheItem.item, this.namespace + '.resource.' + rid + '.' + event, { item: cacheModel.item, idx });

		let indirect = cacheModel.removeIndirect();
		// Don't we have a subscription to the model and no indirect references?
		if (!cacheModel.subscribed && !indirect) {
			if (cacheModel.direct) {
				// If there are direct references to the model, the data
				// should now be considered stale. A new subscription
				// is triggered.
				this._setStale(modelId);
			} else {
				// If there are no references, just delete it from the cache
				delete this.cache[modelId];
			}
		}
	}

	_handleUnsubscribeEvent(rid, cacheItem, event) {
		cacheItem.setSubscribed(false);
		if (cacheItem.direct || cacheItem.indirect) {
			this._setStale(rid);
		} else {
			this._removeCacheItem(cacheItem);
		}
		this.eventBus.emit(cacheItem.item, this.namespace + '.resource.' + rid + '.' + event, { item: cacheItem.item });
	}

	_setStale(rid) {
		if (!this.connected) {
			return;
		}

		setTimeout(() => this._subscribeToStale(rid), subscribeStaleDelay);
	}

	_subscribeToStale(rid) {
		if (!this.connected) {
			return;
		}

		// Check for resource in cache
		let cacheItem = this.cache[rid];
		if (!cacheItem || cacheItem.indirect || cacheItem.subscribed) {
			return;
		}

		cacheItem.setSubscribed(true);
		this._send('subscribe.' + rid)
			.then(response => {
				// Assert the cacheItem hasn't changed
				if (cacheItem !== this.cache[rid]) {
					return;
				}

				if (cacheItem.isCollection !== Array.isArray(response)) {
					throw new Error("Resource type inconsistency");
				}

				if (cacheItem.isCollection) {
					let collection = cacheItem.item;
					let i = collection.length;
					let a = new Array(i);
					while (i--) {
						a[i] = collection.atIndex(i).getResourceId();
					}

					let b = response.map(m => m.rid);
					this._patchDiff(a, b,
						(id, m, n, idx) => {
							if (response[n].data) {
								this._getCachedModel(id, response[n].data);
							}
						},
						(id, n, idx) => this._handleAddEvent(rid, cacheItem, 'add', {
							rid: id,
							data: response[n].data,
							idx: idx
						}),
						(id, m, idx) => this._handleRemoveEvent(rid, cacheItem, 'remove', {
							rid: id
						})
					);
				} else {
					this._handleChangeEvent(rid, cacheItem, 'change', response);
				}

				cacheItem.promise = null;
				return cacheItem.item;
			})
			.catch(err => {
				cacheItem.setSubscribed(false);

				if (!cacheItem.subscribed && !cacheItem.indirect && cacheItem.direct) {
					this._setStale(rid);
				}
			});
	}

	_patchDiff(a, b, onKeep, onAdd, onRemove) {
		// Do a LCS matric calculation
		// https://en.wikipedia.org/wiki/Longest_common_subsequence_problem
		let t, i, j, s = 0, aa, bb, m = a.length, n = b.length;

		// Trim of matches at the start and end
		while (s < m && s < n && a[s] === b[s]) {
			s++;
		}
		while (s <= m && s <= n && a[m - 1] === b[n - 1]) {
			m--;
			n--;
		}

		if (s > 0 || m < a.length) {
			aa = a.slice(s, m);
			m = aa.length;
		} else {
			aa = a;
		}
		if (s > 0 || n < b.length) {
			bb = b.slice(s, n);
			n = bb.length;
		} else {
			bb = b;
		}

		// Create matrix and initialize it
		let c = new Array(m + 1);
		for (i = 0; i <= m; i++) {
			c[i] = t = new Array(n + 1);
			t[0] = 0;
		}
		t = c[0];
		for (j = 1; j <= n; j++) {
			t[j] = 0;
		}

		for (i = 0; i < m; i++) {
			for (j = 0; j < n; j++) {
				c[i + 1][j + 1] = aa[i] === bb[j]
					? c[i][j] + 1
					: Math.max(c[i + 1][j], c[i][j + 1]);
			}
		}

		for (i = a.length - 1; i >= s + m; i--) {
			onKeep(a[i], i, i - m + n, i);
		}
		let idx = m + s;
		i = m;
		j = n;
		let r = 0;
		let adds = [];
		while (true) {
			m = i - 1;
			n = j - 1;
			if (i > 0 && j > 0 && aa[m] === bb[n]) {
				onKeep(aa[m], m + s, n + s, --idx);
				i--;
				j--;
			} else if (j > 0 && (i === 0 || c[i][n] >= c[m][j])) {
				adds.push([ n, idx, r ]);
				j--;
			} else if (i > 0 && (j === 0 || c[i][n] < c[m][j])) {
				onRemove(aa[m], m + s, --idx);
				r++;
				i--;
			} else {
				break;
			}
		}
		for (i = s - 1; i >= 0; i--) {
			onKeep(a[i], i, i, i);
		}

		// Do the adds
		let len = adds.length - 1;
		for (i = len; i >= 0; i--) {
			[ n, idx, j ] = adds[i];
			onAdd(bb[n], n + s, idx - r + j + len - i);
		}
	}

	_subscribeToAllStale() {
		for (let rid in this.cache) {
			this._subscribeToStale(rid);
		}
	}

	/**
	 * Handles the websocket onopen event
	 * @param {object} e Open event object
	 * @private
	 */
	_handleOnopen(e) {
		this.connected = true;

		Promise.resolve(this.onConnect ? this.onConnect() : null)
			.then(() => {
				this._subscribeToAllStale();
				this._emit('connect', e);
				this._connectResolve();
			})
			.catch(err => {
				if (this.ws) {
					this.ws.close();
				}
			});
	}

	/**
	 * Handles the websocket onerror event
	 * @param {object} e Error event object
	 * @private
	 */
	_handleOnerror(e) {
		this._connectReject(e);
	}

	/**
	 * Handles the websocket onmessage event
	 * @param {object} e Message event object
	 * @private
	 */
	_handleOnmessage(e) {
		this._receive(e.data);
	}

	/**
	 * Handles the websocket onclose event
	 * @param {object} e Close event object
	 * @private
	 */
	_handleOnclose(e) {
		this.connectPromise = null;
		this.ws = null;
		if (this.connected) {
			this.connected = false;
			this._emit('close', e);
		}

		// Set any item in cache to stale
		for (let id in this.cache) {
			this.cache[id].setSubscribed(false);
		}

		if (this.tryConnect) {
			this._reconnect();
		}
	}

	/**
	 * Resolves the connection promise
	 * @private
	 */
	_connectResolve() {
		if (this.connectCallback) {
			this.connectCallback.resolve();
			this.connectCallback = null;
		}
	}

	/**
	 * Rejects the connection promise
	 * @param {*} e Error event
	 * @private
	 */
	_connectReject(e) {
		this.connectPromise = null;
		this.ws = null;

		if (this.connectCallback) {
			this.connectCallback.reject(e);
			this.connectCallback = null;
		}
	}

	_emit(event, data, ctx) {
		this.eventBus.emit(event, data, this.namespace);
	}

	/**
	 * Model factory callback for the Model Type
	 * @callback module/Api~modelFactoryCallback
	 * @param {module/Api} api Api module
	 * @param {string} rid Resource id of model
	 * @param {object} data Model data
	 */

	/**
	 * Model type definition object
	 * @typedef {object} module/Api~ModelType
	 * @property {string} id Id of model type. Should be service name and type name. Eg. 'userService.user'
	 * @property {module/Api~modelFactoryCallback} modelFactory Model factory callback
	 */

	/**
	 * Register a model type
	 * @param {module/Api~ModelType} modelType Model type definition object
	 */
	registerModelType(modelType) {
		if (this.modelTypes[modelType.id]) {
			throw new Error(`Model type ${modeType.id} already registered`);
		}

		if (!modelType.id || !modelType.id.match(/^[^.]+\.[^.]+$/)) {
			throw new Error(`Invalid model type id: ${modelType.id}`);
		}

		this.modelTypes[modelType.id] = modelType;
	}

	/**
	 * Unregister a model type
	 * @param {string} modelTypeId Id of model type
	 * @returns {?object} Model type definition object, or null if it wasn't registered
	 */
	unregisterModelType(modelTypeId) {
		let modelType = this.modelTypes[modelTypeId];

		if (!modelType) {
			return null;
		}

		delete this.modelTypes[modelTypeId];
		return modelType;
	}

	/**
	 * Get a resource from the backend
	 * @param {string} rid Resource ID
	 * @param {function} [collectionFactory] Collection factory function.
	 * @return {Promise.<Model|Collection>} Promise of the resourcce
	 */
	getResource(rid, collectionFactory = defaultCollectionFactory) {
		// Check for resource in cache
		let cacheItem = this.cache[rid];
		if (cacheItem) {
			return cacheItem.promise ? cacheItem.promise : Promise.resolve(cacheItem.item);
		}

		cacheItem = new CacheItem(rid, this._unsubscribeCacheItem).setSubscribed(true);
		cacheItem.setPromise(this._send('subscribe.' + rid)
			.then(response => {
				if (Array.isArray(response)) {
					let modelConts = response.map(m => {
						let cacheModel = this._getCachedModel(m.rid, m.data, true);
						return {
							rid: m.rid,
							model: cacheModel.item
						};
					});

					cacheItem.setItem(collectionFactory(this, rid, modelConts));
					cacheItem.setIsCollection();
				} else {
					let modelType = this._getModelType(rid);
					cacheItem.setItem(modelType.modelFactory(
						this,
						rid,
						response
					)).setType(modelType);
				}

				cacheItem.promise = null;
				return cacheItem.item;
			})
			.catch(err => {
				// Do not cache an error
				cacheItem.setSubscribed(false);
				delete this.cache[rid];
				throw err;
			})
		);

		this.cache[rid] = cacheItem;
		return cacheItem.promise;
	}

	/**
	 * Create a new model resource
	 * @param {string} collectionId Existing collection in which the resource is to be created
	 * @param {?object} props Model properties
	 * @returns {Promise.<Model>} Promise of the created model
	 */
	createModel(collectionId, props) {
		return this._send('call.' + collectionId + '.new', props).then(response => {
			let cacheModel = this._getCachedModel(response.rid, response.data);
			cacheModel.setSubscribed(true);
			return cacheModel.item;
		});
	}

	removeModel(collectionId, rid) {
		return this._send('call.' + collectionId + '.remove', { rid });
	}

	setModel(modelId, props) {
		return this._send('call.' + modelId + '.set', props);
	}

	callModel(modelId, method, params) {
		return this._send('call.' + modelId + '.' + method, params);
	}

	authenticate(rid, method, params) {
		return this._send('auth.' + rid + '.' + method, params);
	}

	resourceOn(rid, events, handler) {
		let cacheItem = this.cache[rid];
		if (!cacheItem) {
			throw new Error("Resource not found in cache: " + rid);
		}

		cacheItem.addDirect();
		this.eventBus.on(cacheItem.item, events, handler, this.namespace + '.resource.' + rid);
	}

	resourceOff(rid, events, handler) {
		let cacheItem = this.cache[rid];
		if (!cacheItem) {
			throw new Error("Resource not found in cache");
		}

		cacheItem.removeDirect();
		this.eventBus.off(cacheItem.item, events, handler, this.namespace + '.resource.' + rid);
	}

	_unsubscribeCacheItem(cacheItem) {
		let subscribed = cacheItem.subscribed;

		if (cacheItem.isCollection && this.connected) {
			this._subscribeDirectCollectionModels(cacheItem, subscribed);
		}

		if (subscribed) {
			cacheItem.setSubscribed(false);
		}

		if (this.connected && subscribed) {
			this._send('unsubscribe.' + cacheItem.rid).then(() => {
				this._removeCacheItem(cacheItem);
			});
		} else {
			this._removeCacheItem(cacheItem);
		}
	}

	_subscribeDirectCollectionModels(cacheItem, subscribed) {
		let item = cacheItem.item, cacheModel;
		for (let model of item) {
			let modelId = model.getResourceId();
			cacheModel = this.cache[modelId];
			if (!cacheModel) {
				throw new Error("Collection model not found in cache");
			}

			// Are we missing an existing subscription to the model?
			if (!cacheModel.subscribed && cacheModel.direct) {
				if (subscribed) {
					cacheModel.setSubscribed(true);
					this._send('subscribe.' + modelId);
				} else {
					this._setStale(modelId);
				}

			}
		}
	}

	_removeCacheItem(cacheItem) {
		if (cacheItem.subscribed || cacheItem.indirect) {
			return;
		}

		let item = cacheItem.item, cacheModel;
		if (cacheItem.isCollection) {
			for (let model of item) {
				let modelId = model.getResourceId();
				cacheModel = this.cache[modelId];
				if (!cacheModel) {
					throw "Collection model not found in cache";
				}

				let indirect = cacheModel.removeIndirect();
				// Are we missing an existing subscription to the model?
				if (!indirect && !cacheModel.direct) {
					// If there are no references, just delete it from the cache
					delete this.cache[modelId];
				}
			}
		}

		delete this.cache[cacheItem.rid];
	}

	_getCachedModel(rid, data, addIndirect = false) {
		let cacheItem = this.cache[rid];
		if (cacheItem) {
			// A data object on existing cacheItem indicates
			// the item is stale and we should update it.
			if (data) {
				this._handleChangeEvent(rid, cacheItem, 'change', data);
			}
			if (addIndirect) {
				cacheItem.addIndirect();
			}
		} else {
			let modelType = this._getModelType(rid);
			cacheItem = new CacheItem(rid, this._unsubscribeCacheItem);
			if (addIndirect) {
				cacheItem.addIndirect();
			}
			cacheItem
				.setItem(modelType.modelFactory(
					this,
					rid,
					data
				))
				.setType(modelType);

			this.cache[rid] = cacheItem;
		}

		return cacheItem;
	}

	_getModelType(resourceName) {
		let l = resourceName.length, n = 2, i = -1;
		while (n-- && i++ < l){
			i = resourceName.indexOf('.', i);
			if (i < 0) {
				i = resourceName.length;
				break;
			}
		}

		let typeName = resourceName.substr(0, i);

		return this.modelTypes[typeName] || defaultModelType;
	}

	_reconnect() {
		setTimeout(() => {
			if (!this.tryConnect) {
				return;
			}

			this.connect();
		}, reconnectDelay);
	}

	_resolvePath(url) {
		if (url.match(/^wss?:\/\//)) {
			return url;
		}

		let a = document.createElement('a');
		a.href = url;

		return a.href.replace(/^http/, 'ws');
	}
}

export default ResClient;
