# REST API Evaluator

This project is a React + Node.js application that fetches, processes, and displays REST API endpoint data in a user-friendly interface.

---

## Deployment Instructions

1. **Clone the repository:**

   ```bash
   git clone https://github.com/MdMizanSk/rest-api-evaluater.git
   cd rest-api-evaluater
Install dependencies for both server and client:

For the backend (Node.js server):

```bash
cd server
npm install
```
For the frontend (React client):

```bash

cd ../client
npm install
```
Start the backend server:

```bash

cd ../server
npm start
```
This will start the API server on http://localhost:8000.

Start the frontend client:

Open a new terminal window/tab, then:

```bash

cd client
npm start
```
This will open the React app in your browser at http://localhost:3000.

Steps to Run the Application in VS Code
Open the project folder in VS Code.

## Install dependencies:

Open a terminal in VS Code (Ctrl + ~ or from menu).

Run npm install in both the backend and frontend directories as shown above.

## Run the backend server:

Open a terminal tab, navigate to the server directory.

Run npm start or node index.js depending on your setup.

## Run the React frontend:

Open another terminal tab.

Navigate to the client directory.

Run npm start to launch the development server.

## Access the app:

Open your browser and go to http://localhost:3000.

## Assumptions Made
1.  The backend server runs on localhost:8000 and serves API endpoints as per the project requirements.

2.  The React frontend runs on localhost:3000 and communicates with the backend server for data.

3.   CORS is handled properly in the backend server to allow requests from the React frontend.

4.  You have Node.js and npm installed on your system.

5.  The project folders are structured with separate server and client directories (adjust paths as necessary).

6.  You use VS Code as the development environment (but other editors will also work).



