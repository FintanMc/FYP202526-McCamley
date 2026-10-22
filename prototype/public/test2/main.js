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


const nameInput = locate("#name-input")

locate("#join-button").addEventListener("click", () => {
  sendRequest("/api/join", {name: nameInput.value}, async (response) => {
    const player = await response
    console.log("Joined:", player)
    locate("#me").innerText = `You are ${player.name || player.id}`
    
    socket.emit("sync")
  })
})

socket.on("update", (state) => {
  console.log("state synced", state)
  const { title } = state
  
  locate("#main-header").innerText = title
})

locate("#start-button").addEventListener("click", () => {
  sendRequest("/api/start", {}, async (response) => {
    const state = await response
    console.log("Game started:", state)
  })
})