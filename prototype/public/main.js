import { io } from "https://cdn.socket.io/4.8.3/socket.io.esm.min.js";
if(!sessionStorage.getItem("clientID")) sessionStorage.setItem("clientID", crypto.randomUUID())

const socket = io("/", {
  extraHeaders: {
    "clientID": sessionStorage.getItem("clientID")
  }
})

const header = document.querySelector("h1")


socket.on("stateChange", (state)=>{
  console.log(state)
  const {phase, players} = state

  let text = ""
  switch(phase.type){
    case "RULES":
      text = "Rules: Take turns one by one, press 'next phase' to continue"
    break

    case "RESULTS":
      text = "Results:"
      for(const player of players){
        text += `${player.name}: ${player.score}, `
      }
    break

    default:
      text = "Phase: " + phase.title + ", Players: "
      Object.values(players).forEach(v=> text += v.name + ", ")
    break
  }

  header.innerHTML = text
})

document.querySelector("#next").addEventListener("click", ()=> socket.emit("next"))
document.querySelector("#turn").addEventListener("click", ()=> socket.emit("turn", (error)=> console.error(error)))

document.querySelector("#join").addEventListener("click", ()=> {
  const room = document.querySelector("#room").value
  const name = document.querySelector("#name").value

  socket.emit("join or make game", room, name, p=> {
    console.log(p)
    document.querySelector("title").innerHTML = `${p.name} | FYP-WIP`
  })
})