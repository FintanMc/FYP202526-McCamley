const express = require("express")
const app = express()
app.use(express.static("public"))

const appServer = app.listen(3000, ()=>{
  console.log("app started")
})

const {Server} = require("socket.io")

const io = new Server(appServer)

function event(){
  const subscribers = new Set()
  function e(val){ subscribers.forEach(s=>s(val))}
  e.subscribe = (s) => { 
    subscribers.add(s);
    s.unsubscribe = () => e.unsubscribe(s)
    return s 
  }
  e.unsubscribe = (s) => subscribers.delete(s)
  return e
}

class Game{
  constructor(){
    this.players = {}
    this.stateChange = event()

    this.phaseQueue = [
      new JoinPhase(),
      new RoundPhase(1),
      new RoundPhase(2),
    ]
  }

  get phase(){ return this.phaseQueue[0] }

  nextPhase(){ 
    this.phaseQueue.shift()

    try{
      this.phase.setTurnsQueue(Object.values(this.players))
    }catch(e){}

    this.stateChange() 
  }

  takeTurn(player){
    try{
      this.phase.takeTurn(player)
        ? this.nextPhase()
        : this.stateChange()
    }catch(e){
      console.error("unable to take turn", e)
    }
  }

  joinGame(id){
    try{
      const player = this.phase.createPlayer(id)
      this.players[`${id}`] = player
      this.stateChange()
      return player
    }catch(e){
      console.log("unable to join: incorrect phase")
      return null
    }
  }

  leaveGame(id){
    delete this.players[`${id}`]

    try{
      this.phase.removeTurn(id)
    }catch(e){}

    this.stateChange()
  }
}

class JoinPhase {
  title="Join phase"

  createPlayer(id){
    return {id, score: 0}
  }
}

class RoundPhase{
  constructor(round){
    this.round = round
    this.title = "Round " + round
  }

  setTurnsQueue(turnsQueue){
    this.turnsQueue = turnsQueue
  }

  removeTurn(id){
    this.turnsQueue = this.turnsQueue.filter(t => t.id != id)
  }

  takeTurn(turn){
    if(this.turnsQueue.includes(turn)){
      turn.score += Math.floor(Math.random() * 10)
      this.turnsQueue.shift()

      return this.turnsQueue.length == 0
    }
    throw new Error("out of turn")
  }
}

const game = new Game()

io.on("connection", (socket)=>{
  console.log("connected", socket.id)
  const stateChange = game.stateChange.subscribe(() => socket.emit("stateChange", 
    {
      phase: game.phase || {title: "No phase"},
      players: game.players,
      turnsQueue: game.turnQueue
    }
  ))
  
  const player = game.joinGame(socket.id)
  if(!player) stateChange.unsubscribe()

  socket.on("next", ()=> game.nextPhase())
  socket.on("turn", ()=> game.takeTurn(player))

  socket.on("disconnect", ()=>{
    console.log("disconnected", socket.id)
    game.leaveGame(socket.id)
    stateChange.unsubscribe()
  })
})