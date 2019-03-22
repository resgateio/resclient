import React, { Component } from 'react';
import Book from './Book';

class BookList extends Component {
	onUpdate = () => {
		this.setState({});
	}

	componentDidMount() {
		this.props.books.on('add', this.onUpdate);
		this.props.books.on('remove', this.onUpdate);
	}

	componentWillUnmount() {
		this.props.books.off('add', this.onUpdate);
		this.props.books.off('remove', this.onUpdate);
	}

	render() {
		// ResClient Collections are iterables, but not arrays.
		return (
			<div className="BookList">
				{ Array.from(this.props.books).map(m => <Book key={m.id} books={this.props.books} book={m} showError={this.props.showError} />) }
			</div>
		);
	}
}

export default BookList;
