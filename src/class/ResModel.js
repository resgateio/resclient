import { obj } from 'modapp-utils';

/**
 * Change event emitted on any change to one or more public (non-underscore) properties.
 * @callback ResModel~changeCallback
 * @param {Object.<string,*>} changed Changed key/value object where key is the changed property, and value is the old property value.
 * @param {Model} model ResModel emitting the event.
 * @param {string} event Event name including namespace.
 * @param {?string} action Event action.
 */

/**
 * ResModel represents a model provided over the RES API.
 * @implements {module:modapp~Model}
 */
class ResModel {

	/**
	 * Creates a ResModel instance
	 * @param {ResClient} api ResClient instance
	 * @param {string} rid Resource id.
	 * @param {object} [opt] Optional parameters.
	 * @param {object} [opt.definition] Object definition. If not provided, any value will be allowed.
	 */
	constructor(api, rid, opt) {
		obj.update(this, opt, {
			definition: { type: '?object', property: '_definition' }
		});

		this._rid = rid;
		this._api = api;
	}

	/**
	 * Model resource ID
	 * @returns {string} Resource ID
	 */
	getResourceId() {
		return this._rid;
	}

	/**
	 * Attach a model event handler function for one or more events.
	 * If no event or handler is provided, the model will still be considered listened to,
	 * until a matching off call without arguments is made.
	 * Available events are 'change', or custom events.
	 * @param {?string} [events] One or more space-separated events. Null means any event.
	 * @param {ResModel~changeCallback|eventCallback} [handler] Handler function to execute when the event is emitted.
	 * @returns {this}
	 */
	on(events, handler) {
		this._api.resourceOn(this._rid, events, handler);
		return this;
	}

	 /**
	 * Remove a model event handler function.
	 * Available events are 'change', or custom events.
	 * @param {?string} events One or more space-separated events. Null means any event.
	 * @param {ResModel~changeCallback|eventCallback} [handler] Handler function to remove.
	 * @returns {this}
	 */
	off(events, handler) {
		this._api.resourceOff(this._rid, events, handler);
		return this;
	}

	/**
	 * Calls the set method to update model properties.
	 * @param {object} props Properties. Set value to undefined to delete a property.
	 * @returns {Promise.<object>} Promise of the call being completed.
	 */
	set(props) {
		return this._api.setModel(this._rid, props);
	}

	/**
	 * Calls a method on the model.
	 * @param {string} method Method name
	 * @param {*} params Method parameters
	 * @returns {Promise.<object>} Promise of the call result.
	 */
	call(method, params) {
		return this._api.call(this._rid, method, params);
	}

	/**
	 * Calls an auth method on the model.
	 * @param {string} method Auth method name
	 * @param {*} params Method parameters
	 * @returns {Promise.<object>} Promise of the auth result.
	 */
	auth(method, params) {
		return this._api.authenticate(this._rid, method, params);
	}

	/**
	 * Initializes the model with a data object.
	 * Should only be called by the ResClient instance.
	 * @param {object} data Data object
	 * @private
	 */
	__init(data) {
		this.__update(data);
	}

	/**
	 * Updates the model.
	 * Should only be called by the ResClient instance.
	 * @param {object} props Properties to update
	 * @returns {?object} Changed properties
	 * @private
	 */
	__update(props) {
		if (!props) {
			return null;
		}

		let changed = null;
		let v;
		if (this._definition) {
			changed = obj.update(this, props, this._definition);
		} else {
			for (let key in props) {
				if (props.hasOwnProperty(key) &&
					key.substr(0, 1) !== '_' &&
					(this.hasOwnProperty(key) || !this[key])
				) {
					v = props[key];
					if (v !== this[key]) {
						changed = changed || {};
						changed[key] = this[key];
						if (v === undefined) {
							delete this[key];
						} else {
							this[key] = v;
						}
					}
				}
			}
		}

		return changed;
	}

	toJSON() {
		let o, v;
		if (this._definition) {
			o = obj.copy(this, this._definition);
		} else {
			o = {};
			for (let key in this) {
				if (this.hasOwnProperty(key) &&
					key.substr(0, 1) !== '_'
				) {
					o[key] = this[key];
				}
			}
		}
		for (let k in o) {
			v = o[k];
			if (typeof v === 'object' && v !== null && v.toJSON) {
				o[k] = v.toJSON();
			}
		}
		return o;
	}
}

export default ResModel;
