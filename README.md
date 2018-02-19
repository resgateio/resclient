[![view on npm](http://img.shields.io/npm/v/resclient.svg)](https://www.npmjs.org/package/resclient)

# RES Client
Javascript client implementing the RES-Client Protocol.

## Installation

With npm:
```sh
npm install resclient
```

With yarn:
```sh
yarn add resclient
```

## Usage

Javascript client:
```
npm install resclient
npm install modapp
```

```javascript
import ResClient from 'resclient';
import eventBus from 'modapp/eventBus';

const client = new ResClient(eventBus, 'ws://localhost:8080/ws');

client.getResource('exampleService.myModel').then(model => {
	alert(model.message);

	// Listen to changes for 5 seconds, eventually unsubscribing
	let onChange = () => alert("Message: " + model.message);
	model.on('change', onChange);
	setTimeout(() => model.off('change', onChange), 5000);
});
```