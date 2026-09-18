const express = require("express")
const app = express()
app.use(express.static("public"))

const appServer = app.listen(3000, ()=>{
  console.log("app started http://localhost:3000")
})

const { Server } = require("socket.io")

const io = new Server(appServer)

//#region utils
function event(initial){
  const subscribers = new Set(initial? [initial] : [])
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
  constructor(code){
    this.code = code
    this.stateChange = event()
    this.players = new PlayerRepo()
    this.players.playersUpdated.subscribe(()=> this.stateChange())
    this.start()
  }

  start(){
    this.phaseQueue = [new JoinPhase()]

    this.players.forEach((player)=> player.update(p => {return {...p, score:0}}))

    this.phase.initialize(this.players)
    this.stateChange()
  }

  get phase(){ return this.phaseQueue[0] }

  nextPhase(){ 
    this.phase.onNextPhase(this.phaseQueue)
    if(this.phaseQueue.length == 1) return this.start()

    this.phaseQueue.shift()
    this.phase && this.phase.initialize(this.players)
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
      let player = this.getPlayer(id)
      if(!player){
        player = this.phase.createPlayer(id, meta)
        this.players.addPlayer(id, player)
      }
      return player
    }
    catch (e){ throw `${id} unable to join game` }
  }

  getPlayer(id){
    return this.players.getPlayer(id)
  }

  queueleave(id){
    this.players.queueForDeletion(id, ()=> {
      if(this.players.length == 0) try { this.clean() } catch {}
      try{ this.phase.removeTurn(id) } catch{}
    })
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
    this.turnsQueue = [...players.ids]
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

//#region Repos
class GameRepository{
  constructor(){ this.games = new Map() }
  addGame = (code, game) => { game.clean = () => { this.deleteGame(code) }; this.games.set(code, game); return game }
  deleteGame = (code) => { this.games.delete(code)}
  getGame = (code) => this.games.get(code)
  queryGame = (query) => [...this.games.values()].find(query)
  getOrAddGame = (code) => this.getGame(code) || this.addGame(code, new Game(code))
}

class PlayerRepo{
  constructor(){ this.players = new Map(); this.deleteMap = new Map(); this.playersUpdated = event() }
  addPlayer = (id, player) => {
    this.players.set(id, player)
    this.deleteMap.get(id)?.close()
    this.deleteMap.delete(id)
    this.playersUpdated()
    return player
  }
  deletePlayer = (id) => { this.players.delete(id); this.playersUpdated() }
  queueForDeletion = (id, callback) => {this.deleteMap.set(id, setTimeout(()=> { this.deletePlayer(id); callback() }, 10000))}
  getPlayer = (id) => this.players.get(id)
  queryPlayer = (query) => [...this.players.values()].find(query)
  getOrAddPlayer = (id, name) => this.getPlayer(id) || this.addPlayer(id, signal({name, score: 0}))
  get length(){ return this.players.size}
  get array(){ return Array.from(this.players.values())}
  get ids(){ return Array.from(this.players.keys())}
  forEach = (fn) => this.players.forEach((player, id) => player = fn(player))
}
//#endregion

const gameRepo = new GameRepository()

io.on("connection", (socket)=>{
  let player

  const assignGame = event((game)=>{
    const stateChange = game.stateChange.subscribe(() => socket.emit("stateChange",
      {
        code: game.code,
        phase: game.phase || new Phase("default"),
        players: game.players.array.map(p=>p())
      }
    ))

    socket.on("next", ()=> game.nextPhase())
    socket.on("turn", (error)=> { try{ game.takeTurn(player) } catch(e){ error(e) } })

    socket.on("disconnect", ()=>{
      console.log(socket.id, "disconnected")
      game.queueleave(clientid)
      stateChange.unsubscribe()
    })
  })

  const { clientid } = socket.handshake.headers
  console.log(socket.id, "connected", {clientid})

  let game = gameRepo.queryGame(g => !!g.getPlayer(clientid))
  if(game) {
    assignGame(game)
    player = game.joinGame(clientid, {})
  }

  socket.on("join or make game", (code, name, me)=>{
    if(game) return
    game = gameRepo.getOrAddGame(code)
    console.log(name, game)
    assignGame(game)
    
    try{
      player = game.joinGame(clientid, { name })
      me(player())
    }
    catch(e){
      console.error(e)
    }
  })

})