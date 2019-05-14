# Book Collection example - React

This is a React version of [Resgate's Book Collection example](https://github.com/resgateio/resgate/tree/master/examples/book-collection). It contains both a client and a server written for *node.js*.

The purpose of this example is to show how ResClient can be used together with React. To learn more about writing services for Resgate, visit the [Resgate project](https://github.com/resgateio/resgate).

## Prerequisite

* Have [NATS Server](https://nats.io/download/nats-io/gnatsd/) and [Resgate](https://github.com/resgateio/resgate) running
* Have [node.js](https://nodejs.org/en/download/) installed

## Running the example

Run the following commands:
```bash
npm install
npm start
```

Or run server and client in two separate consoles:
```bash
npm run start-server
npm run start-client
```

Open the client
```
http://localhost:3000
```

## Notes

In the example, ResClient resources are passed as *props* to the React components. This allows the component to listen to events itself without having to rely on the parent, but uses `forceUpdate` to trigger rendering on events.

Suggestions on how to improve the example are appreciated.

## Things to try out

**Realtime updates**  
Run the client in two separate tabs to observe realtime updates.

**System reset**  
Run the client and make some changes. Restart the server to observe resetting of resources in client.

**Resynchronization**  
Run the client on two separate devices. Disconnect one device, then make changes with the other. Reconnect the first device to observe resynchronization.


## Web resources

### Get book collection
```
GET http://localhost:8080/api/bookService/books
```

### Get book
```
GET http://localhost:8080/api/bookService/book/<BOOK_ID>
```

### Update book properties
```
POST http://localhost:8080/api/bookService/book/<BOOK_ID>/set
```
*Body*  
```
{ "title": "Animal Farming" }
```

### Add new book
```
POST http://localhost:8080/api/bookService/books/add
```
*Body*  
```
{ "title": "Dracula", "author": "Bram Stoker" }
```

### Delete book
```
POST http://localhost:8080/api/bookService/books/delete
```
*Body*  
```
{ "id": <BOOK_ID> }
```