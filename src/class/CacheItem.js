const unsubscribeDelay = 5000; // ms

class CacheItem {

	/**
	 * Creates a CacheItem instance
	 * @param {string} rid Resource ID
	 * @param {function} unsubcribeCallback Unsubscribe callback
	 */
	constructor(rid, unsubcribeCallback) {
		this.rid = rid;
		this._unsubscribe = unsubcribeCallback;

		this.type = null;
		this.item = null;
		this.direct = 0;
		this.indirect = 0;
		this.subscribed = false;
		this.promise = null;

		this._checkUnsubscribe();
	}

	setSubscribed(isSubscribed) {
		this.subscribed = isSubscribed;
		if (!isSubscribed && this.unsubTimeout) {
			clearTimeout(this.unsubTimeout);
			this.unsubTimeout = null;
		}
		return this;
	}

	setPromise(promise) {
		if (!this.item) {
			this.promise = promise;
		}
		return this;
	}

	setItem(item, type) {
		this.item = item;
		this.type = type;
		this.promise = null;
		if (this.subscribed) {
			this._checkUnsubscribe();
		}
		return this;
	}

	setType(modelType) {
		this.type = modelType;
		return this;
	}

	addDirect() {
		if (!this.direct && this.unsubTimeout) {
			clearTimeout(this.unsubTimeout);
			this.unsubTimeout = null;
		}
		this.direct++;
	}

	removeDirect() {
		this.direct--;
		if (this.direct < 0) {
			throw "Direct count reached below 0";
		}
		this._checkUnsubscribe();
	}

	_checkUnsubscribe() {
		if (this.direct || this.indirect || this.unsubTimeout) {
			return;
		}

		// Check if we are subscribed, we delay unsubscribing.
		// If not, the data is anyway stale and may be removed directly
		if (this.subscribed) {
			this.unsubTimeout = setTimeout(() => this._unsubscribe(this), unsubscribeDelay);
		} else {
			this._unsubscribe(this);
		}
	}

	addIndirect() {
		this.indirect++;
	}

	removeIndirect() {
		this.indirect--;
		if (this.indirect < 0) {
			throw "Indirect count reached below 0";
		}
		this._checkUnsubscribe();
	}

}

export default CacheItem;
