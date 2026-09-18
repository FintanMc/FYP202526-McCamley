const express = require("express")
const app = express()
app.use(express.static("public"))

const appServer = app.listen(3000, ()=>{
  console.log("app started")
})

const { Server } = require("socket.io")

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
    this.start()
  }

  start(){
    this.phaseQueue = [
      new JoinPhase(),
      new RoundPhase(1),
      new RoundPhase(2),
      new ResultsPhase()
    ]

    for(const [key, value] of Object.entries(this.players)){
      this.players[key] = {...value, score: 0}
    }

    this.stateChange()
  }

  get phase(){ return this.phaseQueue[0] }

  nextPhase(){ 
    if(this.phaseQueue.length == 1) return this.start()
    this.phaseQueue.shift()
    this.phase && this.phase.initialize(Object.values(this.players))
    this.stateChange() 
  }

  takeTurn(player){
    try{
      this.phase.takeTurn(player)
        ? this.nextPhase()
        : this.stateChange()
    }
    catch{ throw `${player.id} unable to take turn` }
  }

  joinGame(id){
    try{
      const player = this.phase.createPlayer(id)
      this.players[`${id}`] = player
      this.stateChange()
      return player
    }
    catch{ throw `${id} unable to join game` }
  }

  leaveGame(id){
    delete this.players[`${id}`]
    try{ this.phase.removeTurn(id) } catch{}
    this.stateChange()
  }
}

class Phase{
  constructor(type, title){
    this.type = type
    this.title = title
  }

  initialize(players){}
}

class JoinPhase extends Phase {
  constructor(){
    super("JOIN", "Join phase")
  }

  createPlayer(id){
    return {id, score: 0}
  }
}

class RoundPhase extends Phase{
  constructor(round){
    super("ROUND", `Round ${round}`)
    this.round = round
  }

  initialize(players){
    this.turnsQueue = players.map(p => p.id)
  }

  removeTurn(id){
    this.turnsQueue = this.turnsQueue.filter(t => t != id)
  }

  takeTurn(player){
    if(this.turnsQueue[0] == player.id){
      player.score += Math.floor(Math.random() * 10)
      this.turnsQueue.shift()

      return this.turnsQueue.length == 0
    }
    throw "out of turn"
  }
}

class ResultsPhase extends Phase{
  constructor(){
    super("RESULTS", "Results phase")
  }
}

const game = new Game()

io.on("connection", (socket)=>{
  console.log(socket.id, "connected")
  const stateChange = game.stateChange.subscribe(() => socket.emit("stateChange", 
    {
      phase: game.phase || {title: "No phase"},
      players: game.players,
      turnsQueue: game.turnQueue
    }
  ))
  
  try{
    const player = game.joinGame(socket.id)
  
    socket.on("next", ()=> game.nextPhase())
    socket.on("turn", (error)=> { try{ game.takeTurn(player) } catch(e){ error(e) } })
  }
  catch(e){ 
    console.error(e)
    stateChange.unsubscribe()
  }

  socket.on("disconnect", ()=>{
    console.log(socket.id, "disconnected")
    game.leaveGame(socket.id)
    stateChange.unsubscribe()
  })
})