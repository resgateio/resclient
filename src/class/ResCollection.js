import { obj } from 'modapp-utils';

/**
 * Add event data
 * @typedef {object} ResCollection~addEvent
 * @property {*} item Item being added to the collection.
 * @property {number} idx Index where item was added.
 */

/**
 * Add event emitted on any item being added to the collection.
 * @callback ResCollection~addCallback
 * @param {Collection~addEvent} event Add event data.
 * @param {Collection} collection Collection emitting event.
 * @param {string} event Event name including namespace.
 * @param {?string} action Event action.
 */

/**
 * Remove event data
 * @typedef {object} ResCollection~removeEvent
 * @property {*} item Item being removed from the collection.
 * @property {number} idx Index from where the item was removed.
 */

/**
 * Remove event emitted on any item being added to the collection.
 * @callback ResCollection~removeCallback
 * @param {Collection~removeEvent} event Remove event data.
 * @param {Collection} collection Collection emitting event.
 * @param {string} event Event name including namespace.
 * @param {?string} action Event action.
 */

/**
 * ResCollection represents a collection provided over the RES API.
 * @implements {module:modapp~Collection}
 */
class ResCollection {

	/**
	 * Creates an ResCollection instance
	 * @param {ResClient} api ResClient instance
	 * @param {string} rid Resource id.
	 * @param {object} [opt] Optional settings
	 * @param {function} [opt.idCallback] Id callback function.
	 */
	constructor(api, rid, opt) {
		opt = obj.copy(opt, {
			idCallback: { type: '?function' }
		});

		this._api = api;
		this._rid = rid;
		this._idCallback = opt.idCallback;

		this._map = this._idCallback ? {} : null;
		this._list = null;
	}

	/**
	 * Collection resource ID
	 * @returns {string} Resource ID
	 */
	getResourceId() {
		return this._rid;
	}

	/**
	 * Length of the collection
	 */
	get length() {
		return this._list.length;
	}

	/**
	 * Attach a collection event handler function for one or more events.
	 * If no event or handler is provided, the collection will still be considered listened to,
	 * until a matching off call without arguments is made.
	 * Available events are 'add', 'remove', and custom events.
	 * @param {?string} [events] One or more space-separated events. Null means any event.
	 * @param {ResCollection~addCallback|ResCollection~removeCallback|eventCallback} [handler] Handler function to execute when the event is emitted.
	 * @returns {this}
	 */
	on(events, handler) {
		this._api.resourceOn(this._rid, events, handler);
		return this;
	}

	 /**
	 * Remove a collection event handler function.
	 * Available events are 'add', 'remove', and custom events.
	 * @param {?string} [events] One or more space-separated events. Null means any event.
	 * @param {ResCollection~addCallback|ResCollection~removeCallback|eventCallback} [handler] Handler function to remove.
	 * @returns {this}
	 */
	off(events, handler) {
		this._api.resourceOff(this._rid, events, handler);
		return this;
	}

	/**
	 * Get an item from the collection by id.
	 * Requires that id callback is defined for the collection.
	 * @param {string} id Id of the item
	 * @returns {*} Item with the id. Undefined if key doesn't exist
	 */
	get(id) {
		this._hasId();
		return this._map[id];
	}

	/**
	 * Retrieves the order index of an item.
	 * @param {*} item Item to find
	 * @returns {number} Order index of the first matching item. -1 if the item doesn't exist.
	 */
	indexOf(item) {
		return this._list.indexOf(item);
	}

	/**
	 * Gets an item from the collection by index position
	 * @param {number} idx  Index of the item
	 * @returns {*} Item at the given index. Undefined if the index is out of bounds.
	 */
	atIndex(idx) {
		return this._list[idx];
	}

	/**
	 * Calls a method on the collection.
	 * @param {string} method Method name
	 * @param {*} params Method parameters
	 * @returns {Promise.<object>} Promise of the call result.
	 */
	call(method, params) {
		return this._api.call(this._rid, method, params);
	}

	/**
	 * Returns a shallow clone of the internal array.
	 * @returns {Array.<*>} Clone of internal array
	 */
	toArray() {
		return this._list.slice();
	}

	/**
	 * Initializes the collection with a data array.
	 * Should only be called by the ResClient instance.
	 * @param {Array.<*>} data ResCollection data array
	 * @private
	 */
	__init(data) {
		this._list = data || [];

		if (this._idCallback) {
			this._map = {};
			this._list.forEach(v => {
				let id = String(this._idCallback(v));
				if (this._map[id]) {
					throw new Error("Duplicate id - " + id);
				}
				this._map[id] = v;
			});
		}
	}

	/**
	 * Add an item to the collection.
	 * Should only be called by the ResClient instance.
	 * @param {*} item Item
	 * @param {idx} [idx] Index value of where to insert the item.
	 * @private
	 */
	__add(item, idx) {
		this._list.splice(idx, 0, item);

		if (this._idCallback) {
			let id = String(this._idCallback(item));
			if (this._map[id]) {
				throw new Error("Duplicate id - " + id);
			}
			this._map[id] = item;
		}
	}

	/**
	 * Remove an item from the collection.
	 * Should only be called by the ResClient instance.
	 * @param {number} idx Index of the item to remove
	 * @returns {*} Removed item or undefined if no item was removed
	 * @private
	 */
	__remove(idx) {
		let item = this._list[idx];
		this._list.splice(idx, 1);

		if (this._idCallback) {
			delete this._map[this._idCallback(item)];
		}

		return item;
	}

	_hasId() {
		if (!this._idCallback) {
			throw new Error("No id callback defined");
		}
	}

	toJSON() {
		return this._list.map(v => (
			v !== null && typeof v === 'object' && v.toJSON
				? v.toJSON()
				: v
		));
	}

	[Symbol.iterator]() {
		let i = 0,
			a = this._list,
			l = a.length;

		return {
			next: function() {
				return { value: a[i++], done: i > l };
			}
		};
	}
}

export default ResCollection;
