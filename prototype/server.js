const express = require("express")
const app = express()
app.use(express.static("public"))

const appServer = app.listen(3000, ()=>{
  console.log("app started http://localhost:3000")
})

const { Server } = require("socket.io")

const io = new Server(appServer)

//#region utils
function event(){
  const subscribers = new Set()
  function e(val){ subscribers.forEach(s=>s(val)) }
  e.subscribe = (s) => { 
    subscribers.add(s);
    s.unsubscribe = () => e.unsubscribe(s)
    return s 
  }
  e.unsubscribe = (s) => subscribers.delete(s)
  return e
}

function signal(value){
  let val = value
  function e(){ return val }
  e.set = (v) => val = v
  e.update = (fn) => e.set(fn(val))
  return e
}
//#endregion

class Game{
  constructor(){
    this.players = {}
    this.stateChange = event()
    this.start()
  }

  start(){
    this.phaseQueue = [new JoinPhase()]

    for(const key of Object.keys(this.players)){
      this.players[key].update(p => {return {...p, score:0}})
    }

    this.phase.initialize(Object.values(this.players))
    this.stateChange()
  }

  get phase(){ return this.phaseQueue[0] }

  nextPhase(){ 
    this.phase.onNextPhase(this.phaseQueue)
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
    catch{ throw `${player().id} unable to take turn` }
  }

  joinGame(id, meta){
    try{
      const player = this.phase.createPlayer(id, meta)
      this.players[`${id}`] = player
      this.stateChange()
      return player
    }
    catch{ throw `${id} unable to join game` }
  }

  leaveGame(id){
    delete this.players[`${id}`]
    if(Object.keys(this.players).length == 0) try { this.clean() } catch {}
    try{ this.phase.removeTurn(id) } catch{}
    this.stateChange()
  }
}

//#region phases
class Phase{
  constructor(type, title){
    this.type = type
    this.title = title
  }

  initialize(players){}
  onNextPhase(phaseQueue){}
}

class JoinPhase extends Phase {
  constructor(){
    super("JOIN", "Join phase")
  }

  createPlayer(id, meta){
    return signal({id, score: 0, ...meta})
  }

  onNextPhase(phaseQueue){
    phaseQueue.push(  
      new RulesPhase(),
      new RoundPhase(1),
      new RoundPhase(2),
      new ResultsPhase()
    )
  }
}

class RoundPhase extends Phase{
  constructor(round){
    super("ROUND", `Round ${round}`)
    this.round = round
  }

  initialize(players){
    this.turnsQueue = players.map(p => p().id)
    console.log("Round", this.round, this.turnsQueue)
  }

  removeTurn(id){
    this.turnsQueue = this.turnsQueue.filter(t => t != id)
  }

  takeTurn(player){
    if(this.turnsQueue[0] == player().id){
      player.update(p => {
        p.score += Math.floor(Math.random() * 10)
        return p
      })

      console.log(player().id, "took turn, score:", player().score)
      this.turnsQueue.shift()

      return this.turnsQueue.length == 0
    }
    throw "out of turn"
  }
}

class RulesPhase extends Phase{
  constructor(){
    super("RULES", "Rules")
  }
}

class ResultsPhase extends Phase{
  constructor(){
    super("RESULTS", "Results phase")
  }
}
//#endregion

class GameRepository{
  constructor(){ this.games = new Map() }
  addGame = (code, game) => { game.clean = () => { this.deleteGame(code) }; this.games.set(code, game); return game }
  deleteGame = (code) => { this.games.delete(code)}
  getGame = (code) => this.games.get(code)
  getOrAddGame = (code) => this.getGame(code) || this.addGame(code, new Game())
}

const gameRepo = new GameRepository()

io.on("connection", (socket)=>{
  console.log(socket.id, "connected")

  //const { clientID } = socket.handshake.headers
  const clientID = socket.id
  let game;

  socket.on("join or make game", (code, name, me)=>{
    if(game) return
    game = gameRepo.getOrAddGame(code)

    const stateChange = game.stateChange.subscribe(() => socket.emit("stateChange",
      {
        phase: game.phase || new Phase("default"),
        players: Object.values(game.players).map(p=>p())
      }
    ))
    
    try{
      const player = game.joinGame(clientID, { name })
      me(player())
    
      socket.on("next", ()=> game.nextPhase())
      socket.on("turn", (error)=> { try{ game.takeTurn(player) } catch(e){ error(e) } })

      socket.on("disconnect", ()=>{
        console.log(socket.id, "disconnected")
        game.leaveGame(clientID)
        stateChange.unsubscribe()
      })
    }
    catch(e){ 
      console.error(e)
      stateChange.unsubscribe()
    }
  })

})