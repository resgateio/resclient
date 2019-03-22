[![view on npm](http://img.shields.io/npm/v/resclient.svg)](https://www.npmjs.org/package/resclient)

# ResClient
Javascript client implementing the RES-Client Protocol.

The client is used to connect to a RES API. For more information about the protocol, and some quick start examples, [visit the Resgate project](https://github.com/jirenius/resgate).

## Installation

With npm:
```sh
npm install resclient
```

With yarn:
```sh
yarn add resclient
```

## Example usage

```javascript
import ResClient from 'resclient';

const client = new ResClient('ws://localhost:8080/ws');

client.get('exampleService.myModel').then(model => {
	alert(model.message);

	// Listen to changes for 5 seconds, eventually unsubscribing
	let onChange = () => alert("Message: " + model.message);
	model.on('change', onChange);
	setTimeout(() => model.off('change', onChange), 5000);
});
```

## Full examples

* [Modapp - Book Collection example (original)](https://github.com/jirenius/resgate/tree/master/examples/book-collection)
* [React - Book Collection example](examples/book-collection-react/)
* [Vue.js - Book Collection example](examples/book-collection-vuejs/)


## Documentation

[Markdown documentation](https://github.com/jirenius/resclient/blob/master/docs/docs.md)