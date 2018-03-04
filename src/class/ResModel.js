import * as obj from 'modapp-utils/obj';

/**
 * ResModel holds a model provided over the RES API.
 * @implements {module:modapp~Model}
 */
class ResModel {

	/**
	 * Creats an ResModel instance
	 * @param {ResClient} api ResClient instance
	 * @param {string} rid Resource id.
	 * @param {object} [data] Data object
	 */
	constructor(api, rid, data, opt) {
		obj.update(this, opt, {
			definition: { type: '?object', property: '_definition' }
		});

		this._rid = rid;
		this._api = api;

		this.__update(data);
	}

	/**
	 * Model resource ID
	 * @returns {string} Resource ID
	 */
	getResourceId() {
		return this._rid;
	}

	/**
	 * Attach an event handler function for one or more instance events.
	 * Available event is 'change'
	 * @param {?string} events One or more space-separated events. Null means any event.
	 * @param {EventBus~eventCallback} [handler] A function to execute when the event is emitted.
	 * @returns {this}
	 */
	on(events, handler) {
		this._api.resourceOn(this._rid, events, handler);
		return this;
	}

	 /**
	 * Remove an instance event handler.
	 * Available event is 'change'
	 * @param {?string} events One or more space-separated events. Null means any event.
	 * @param {EventBus~eventCallback} [handler] An option handler function. The handler will only be remove if it is the same handler.
	 * @returns {this}
	 */
	off(events, handler) {
		this._api.resourceOff(this._rid, events, handler);
		return this;
	}

	/**
	 * Sets properties at the backend
	 * @param {object} props Properties
	 * @returns {Promise.<object>} Promise of the changed properties.
	 */
	set(props) {
		return this._api.setModel(this._rid, props);
	}

	/**
	 * Calls a method on the model at the backend
	 * @param {*} method Method
	 * @param {*} params Method parameters
	 * @returns {Promise.<object>} Promise of the call result.
	 */
	call(method, params) {
		return this._api.callModel(this._rid, method, params);
	}

	/**
	 * Updates the model.
	 * Should only be called from api module.
	 * @param {object} props Properties to update
	 * @returns {?object} Changed properties
	 * @private
	 */
	__update(props) {
		if (!props) {
			return null;
		}

		let changed = null;
		if (this._definition) {
			changed = obj.update(this, props, this._definition);
		} else {
			for (let key in props) {
				if (props.hasOwnProperty(key) &&
					key.substr(0,1) !== '_' &&
					(this.hasOwnProperty(key) || !this[key])
				) {
					if (props[key] !== this[key]) {
						changed = changed || {};
						changed[key] = this[key];
						this[key] = props[key];
					}
				}
			}
		}

		return changed;
	}

	toJSON() {
		if (this._definition) {
			return obj.copy(this, this._definition);
		} else {
			let obj = {};
			for (let key in this) {
				if (this.hasOwnProperty(key) &&
					key.substr(0,1) !== '_'
				) {
					obj[key] = this[key];
				}
			}
			return obj;
		}
	}
}

export default  ResModel;