import React, { Component } from 'react';
import ResClient from 'resclient';
import BookList from './BookList';

class App extends Component {
	constructor(props) {
		super(props);

		this.state = {
			title: "",
			author: "",
			books: null
		};

		this.client = new ResClient("ws://127.0.0.1:8080");
	}

	showError = (err) => {

	}

	handleAddNew = () => {
		// Call ResClient to add new book
		this.client.call('library.books', 'new', {
			title: this.state.title,
			author: this.state.author
		}).then(() => {
			// Clear values on successful add
			this.setState(state => ({
				title: "",
				author: ""
			}));
		}).catch(this.showError);
	}

	handleTitleChange = (e) => {
		this.setState({
			title: e.target.value
		});
	}

	handleAuthorChange = (e) => {
		this.setState({
			author: e.target.value
		});
	}

	componentDidMount(){
		// Get the collection from the service.
		this.client.get('library.books').then(books => {
			this.setState({	books });
		}).catch(err => this.showError(err.code === 'system.connectionError'
			? "Connection error. Are NATS Server and Resgate running?"
			: err
		));
	}

	render() {
		return (
			<div className="App">
				<header className="shadow">
					<h1>Book Collection Example</h1>
				</header>
				<div className="top">
					<div className="new-container">
						<label htmlFor="new-title">Title</label>
						<input
							name="new-title"
							value={this.state.title}
							onChange={this.handleTitleChange} />
						<label htmlFor="new-author">Author</label>
						<input
							name="new-author"
							value={this.state.author}
							onChange={this.handleAuthorChange} />
						<button onClick={this.handleAddNew}>Add new</button>
					</div>
					<div id="error-msg"></div>
				</div>
				<hr />
				{
					this.state.books
						? <BookList books={this.state.books}></BookList>
						: null
				}
			</div>
		);
	}
}

export default App;
