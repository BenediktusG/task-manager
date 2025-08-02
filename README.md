# Multi Tenant Task Manager

Real-time task manager API with multi-tenant support using **Express**, **Prisma**, **Socket.IO**, and **Redis**.

## Features
- Multi-tenant task management
- Real-time task notification
- REST API for CRUD operations
- Dockerized setup

## Installation
```bash
git clone https://github.com/BenediktusG/task-manager
cd task-manager
npm install
```

## Running the project
```bash
docker compose up
npm start
```

## Additional Information
- For the .env structure you can see the file ```.env.example```.
- **REST API Documentation**: check ```/docs/openapi.yaml```. Open it using [Swagger Editor](https://editor.swagger.io) or an OpenAPI extension in your editor.
- **WebSocket Events**: check ```/docs/asyncapi.yaml```. Open it using [Async API Sudio](https://studio.asyncapi.com) or an AsyncAPI extension in your editor.