const unsubscribeDelay = 5000; // ms

class CacheItem {

	/**
	 * Creats a CacheItem instance
	 * @param {string} rid Resource ID
	 * @param {function} unsubCallback Unsubscribe callback
	 */
	constructor(rid, unsubCallback) {
		this.rid = rid;
		this._unsubCallback = unsubCallback;

		this.item = null;
		this.direct = 0;
		this.indirect = 0;
		this.isCollection = false;
		this.subscribed = false;
		this.promise = null;
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
		this.promise = promise;
		return this;
	}

	setItem(item) {
		this.item = item;
		this._checkUnsubscribe();
		return this;
	}

	setType(modelType) {
		this.type = modelType;
		return this;
	}

	setIsCollection() {
		this.isCollection = true;
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
		return this.direct;
	}

	_checkUnsubscribe() {
		if (this.unsubTimeout || this.direct || this.indirect) {
			return;
		}

		// Check if we are subscribed, we delay unsubscribing.
		// If not, the data is anyway stale and may be removed directly
		if (this.subscribed) {
			this.unsubTimeout = setTimeout(() => this._unsubCallback(this), unsubscribeDelay);
		} else {
			this._unsubCallback(this);
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
		return this.indirect;
	}
}

export default CacheItem;
