const ResClient = resclient.default;
const ResModel = resclient.ResModel;
const ResCollection = resclient.ResCollection;

// Vue app
const app = Vue.createApp({
	client: null,
	data() {
		return {
			books: null,
			newTitle: "",
			newAuthor: "",
			errMsg: "",
			errTimer: null
		};
	},
	created() {
		// Create ResClient instance and store it outside of data so that it
		// won't be wrapped in a Vue reactive Proxy.
		this.client = new ResClient('ws://localhost:8080')
			// The full wildcard (">") let's us wrap all ResModel/ResCollection
			// instances in a Vue reactive Proxy. This allows Vue to be notified
			// on updates without listening to specific events.
			.registerModelType(">", (api, rid) => Vue.reactive(new ResModel(api, rid)))
			.registerCollectionType(">", (api, rid) => Vue.reactive(new ResCollection(api, rid)));

		this.client.get('library.books').then(books => {
			this.books = books;
		}).catch(this.showError);
	},
	methods: {
		handleAddNew() {
			this.client.call('library.books', 'new', {
				title: this.newTitle,
				author: this.newAuthor
			}).then(() => {
				this.newTitle = "";
				this.newAuthor = "";
			}).catch(this.showError);
		},
		showError(err) {
			this.errMsg = err && err.code && err.code == 'system.connectionError'
				? "Connection error. Are NATS Server and Resgate running?"
				: err && err.message ? err.message : String(err);
			clearTimeout(this.errTimer);
			this.errTimer = setTimeout(() => this.errMsg = "", 7000);
		}
	}
});

// BookList component
app.component('book-list', {
	template: "#book-list-template",
	props: [ 'books' ],
	created() {
		// Add empty listener to prevent ResClient to unsubscribe
		this.books.on();
	},
	beforeUnmount() {
		// Remove empty listener to allow ResClient to unsubscribe
		this.books.off();
	},
	methods: {
		showError(err) {
			this.$emit('error', err);
		}
	}
});

// Book component
app.component('book', {
	template: "#book-template",
	props: [ 'books', 'book' ],
	data() {
		return {
			isEdit: false,
			editTitle: "",
			editAuthor: "",
		};
	},
	created() {
		// Add empty listener to prevent ResClient to unsubscribe
		this.book.on();
	},
	beforeUnmount() {
		// Remove empty listener to allow ResClient to unsubscribe
		this.book.off();
	},
	methods: {
		handleEdit() {
			this.isEdit = true;
			this.editTitle = this.book.title;
			this.editAuthor = this.book.author;
		},
		handleDelete() {
			this.books.call('delete', {
				id: this.book.id
			}).catch(this.showError);
		},
		handleOk() {
			this.book.set({
				title: this.editTitle,
				author: this.editAuthor
			}).then(() => {
				this.isEdit = false;
			}).catch(this.showError);
		},
		handleCancel() {
			this.isEdit = false;
		},
		showError(err) {
			this.$emit('error', err);
		}
	}
});

window.app = app.mount('#app');
