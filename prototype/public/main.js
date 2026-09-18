import { io } from "https://cdn.socket.io/4.8.3/socket.io.esm.min.js";
const socket = io("/")

const header = document.querySelector("h1")

socket.on("stateChange", (state)=>{
  console.log(state)
  const {phase, players} = state
  let out = "Phase: " + phase.title + ", Players: "
  Object.keys(players).forEach(v=> out += v + ", ")

  if(phase.type == "RESULTS"){
    out = "Results:"
    for(const player of Object.values(players)){
      out += `${player.id}: ${player.score}, `
    }
  }
  header.innerHTML = out
})

document.querySelector("#next").addEventListener("click", ()=> socket.emit("next"))
document.querySelector("#turn").addEventListener("click", ()=> socket.emit("turn", (error)=> console.error(error)))