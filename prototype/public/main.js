import { io } from "https://cdn.socket.io/4.8.3/socket.io.esm.min.js";
const clientID = localStorage.getItem("clientID") || crypto.randomUUID()
localStorage.setItem("clientID", clientID)

const socket = io("/", {
  extraHeaders: {
    "clientID": localStorage.getItem("clientID")
  }
})

const header = document.querySelector("#header")
const subtext = document.querySelector("#subtext")
const codeHeader = document.querySelector("#code")

socket.on("stateChange", (state)=>{
  if(!state) {
    document.body.id = "NONE"
    return
  }
  console.log(state)
  const {phase, players, code} = state
  document.body.id = phase.type
  header.innerHTML = phase.title
  codeHeader.innerHTML = `${code}`

  let text = ""
  switch(phase.type){
    case "RULES":
      text = "Take turns one by one, press 'next phase' to continue"
    break

    case "ROUND":
      text = phase.turnsQueue[0] == clientID ? "your turn" : "waiting for your turn"
    break

    case "RESULTS":
      text = "Results: "
      for(const player of players){
        text += `${player.name}: ${player.score}, `
      }
    break

    default:
      text = "Players: "
      Object.values(players).forEach(v=> text += v.name + ", ")
    break
  }

  subtext.innerHTML = text
})

document.querySelector("#next").addEventListener("click", ()=> socket.emit("next"))
document.querySelector("#turn").addEventListener("click", ()=> socket.emit("turn", (error)=> console.error(error)))
document.querySelector("#leave").addEventListener("click", ()=> socket.emit("leave game"))

document.querySelector("#join").addEventListener("click", ()=> {
  const room = document.querySelector("#room").value
  const name = document.querySelector("#name").value

  socket.emit("join or make game", room, name, p => {
    console.log(p)
    document.querySelector("title").innerHTML = `${p.name} | FYP-WIP`
  })
})