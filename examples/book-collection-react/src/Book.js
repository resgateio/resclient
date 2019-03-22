import React, { Component } from 'react';

class Book extends Component {
	constructor(props) {
		super(props);

		this.state = {
			isEdit: false,
			title: "",
			author: ""
		};
	}

	handleEdit = () => {
		this.setState({
			isEdit: true,
			title: this.props.book.title,
			author: this.props.book.author
		});
	}

	handleDelete = () => {
		this.props.books.call('delete', {
			id: this.props.book.id
		}).catch(this.props.showError);
	}

	handleOk = () => {
		this.props.book.set({
			title: this.state.title,
			author: this.state.author
		}).then(() =>
			this.setState({
				isEdit: false
			})
		).catch(this.props.showError);
	}

	handleCancel = () => {
		this.setState({
			isEdit: false
		});
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

	onUpdate = () => {
		this.setState({});
	}

	componentDidMount() {
		this.props.book.on('change', this.onUpdate);
	}

	componentWillUnmount() {
		this.props.book.off('change', this.onUpdate);
	}

	render() {
		return (
			<div className={"Book" + (this.state.isEdit ? " editing" : "")}>
				<div className="card shadow">
					{ this.state.isEdit
						? <div className="edit">
							<div className="action">
								<button onClick={this.handleOk}>OK</button>
								<button onClick={this.handleCancel}>Cancel</button>
							</div>
							<div className="edit-input">
								<span className="label">Title</span>
								<input
									value={this.state.title}
									onChange={this.handleTitleChange} />
							</div>
							<div className="edit-input">
								<span className="label">Author</span>
								<input
									value={this.state.author}
									onChange={this.handleAuthorChange} />
							</div>
						</div>
						: <div className="view">
							<div className="action">
								<button onClick={this.handleEdit}>Edit</button>
								<button onClick={this.handleDelete}>Delete</button>
							</div>
							<div className="title">
								<h3>{this.props.book.title}</h3>
							</div>
							<div className="author">
								<span>By {this.props.book.author}</span>
							</div>
						</div>
					}
				</div>
			</div>
		);
	}
}

export default Book;
