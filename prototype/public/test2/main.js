import { io } from "https://cdn.socket.io/4.8.3/socket.io.esm.min.js";
const socket = io("/")

const sendRequest = (endpoint, data, then = ()=>{}) => {
 fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  }).then((response) => {
    then(response.json());
  });
}

const locate = (identifier) => document.querySelector(identifier)

sendRequest("/api/join", {name: "John Doe"}, async (response) => {
  const player = await response
  locate("#me").innerText = `You are ${player.name}`
  
  socket.emit("sync", (state) => {
    console.log("websocket synced", state)
    const { title } = state
    
    locate("#main-header").innerText = title
  })
});
