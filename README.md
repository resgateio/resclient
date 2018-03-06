[![view on npm](http://img.shields.io/npm/v/resclient.svg)](https://www.npmjs.org/package/resclient)

# RES Client
Javascript client implementing the RES-Client Protocol.

The client is used to connect to a RES API. For more information about the protocol, and some quick start examples, visit the [resgate](https://github.com/jirenius/resgate) project.

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

client.getResource('exampleService.myModel').then(model => {
	alert(model.message);

	// Listen to changes for 5 seconds, eventually unsubscribing
	let onChange = () => alert("Message: " + model.message);
	model.on('change', onChange);
	setTimeout(() => model.off('change', onChange), 5000);
});
```

## Documentation

[Markdown documentation](https://github.com/jirenius/resclient/blob/master/docs/docs.md)