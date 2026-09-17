import { io } from "https://cdn.socket.io/4.8.3/socket.io.esm.min.js";
const socket = io("/")

const header = document.querySelector("h1")

socket.on("stateChange", (state)=>{
  console.log(state)
  let out = "phase: " + state.phase.title + ", players: "
  Object.keys(state.players).forEach(v=> out += v + ", ")
  header.innerHTML = out
})

document.querySelector("#next").addEventListener("click", ()=> socket.emit("next"))
document.querySelector("#turn").addEventListener("click", ()=> socket.emit("turn"))