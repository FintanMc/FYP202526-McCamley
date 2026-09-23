const errorCodes = {
  "NotFound": 404,
  "Unauthorized": 401,
  "Forbidden": 403,
  "BadRequest": 400,
  "InternalServerError": 500
}

class CustomError extends Error {
  constructor(name, message, status){
    super(message)
    this.status = status
    this.name = name
  }}

class ActionNotFoundError extends CustomError {
  constructor(message){
    super(
      "ActionNotFoundError",
      `Action "${message}" not found in the current phase`,
      errorCodes.NotFound
    )
  }
}

function catchable(fn){
  let err = null
  try { fn() } catch (e) { err = e }
  return {catch: (callback) => callback(err)}
}

class GameState {
  #subs = new Set()
  #allPhasesSubs = new Set()

  constructor(meta = {}){
    for(const key in meta) this[key] = meta[key]
  }

  on(name, fn) { this.#subs.add({name, fn}) }
  off(name, fn) { this.#subs.delete({name, fn}) }
  clear() { this.#subs.clear() }

  allPhases = {
    on: (name, fn) => this.#allPhasesSubs.add({name, fn}),
    off: (name, fn) => this.#allPhasesSubs.delete({name, fn}),
    clear: () => this.#allPhasesSubs.clear()
  }

  action(name, ...args){
    const subscribers = [...this.#subs, ...this.#allPhasesSubs]
    if(subscribers.every(s => (s.name != name))) throw new ActionNotFoundError(name)
    subscribers.forEach(s => s.name == name && s.fn(...args))
  }
}

class Game {
  constructor(){
    this.phases = []
    this.state = new GameState({
      players: []
    })
  }

  get currentPhase () { return this.phases[0] }

  start(){
    this.currentPhase(this.state, (err)=> {
      this.nextPhase()
    })
  }

  nextPhase(){
    this.phases.shift()
    this.state.clear()
    this.start()
  }

  /**
   * @callback phases
   * @param {GameState} state - The current game state.
   * @param {() => void} next - The callback to call when the phase is finished.
   */
  /**
   * Register a phase to be used in the game. Phases are executed in the order they are registered.
   * Each phase is a function that takes the current game state and a next callback. The phase should call next() when it is finished.
   * @param {...phases} phases - The phases to register.
   */ 
  usePhase(...phases){
    this.phases.push(...phases)
  }

  request(name, ...args) {
    return catchable(() => this.state.action(name, ...args))
  }
}

const game = new Game()

game.usePhase(
  (state, next)=>{
    console.log("=== Join phase ===")

    state.on("join", (val)=> {
      console.log("Player", val, "joined")
      state.players.push({...val, score: 0})
    })

    state.on("confirm", ()=> next())
  }
)

for(let i = 0; i < 3; i++){
  game.usePhase(
    (state, next)=>{
      console.log("=== Round ", i+1, " ===")

      const turns = new Set(state.players.map(p => p.name))

      state.on("take turn", (val)=>{
        const player = state.players.find(p => p.name === val.name)
        if(!player) throw new Error("Player not in game")
        player.score += Math.floor(Math.random() * 10)
        console.log("Taking turn:", player)
        
        turns.delete(player.name)
        if(turns.size === 0) next()
      })
    }
  )
}

game.usePhase(
  (state, next)=>{
    console.log("=== Results phase ===")

    state.players.forEach((player)=> {
      console.log(`${player.name} scored ${player.score}`)
    })
  }
)

const standardErrorHandler = (err) => err && console.error(`\u001b[31m${err.status || "<no status>"} ${err.name}: ${err.message}\u001b[0m`)

game.start()

//Join phase
game.request("join", {name: "John Doe"})
game.request("join", {name: "Paul Blart"})
game.request("confirm")

//Round 1
game.request("join", {name: "Jane Doe"}).catch(standardErrorHandler)
game.request("take turn", {name: "John Doe"})
game.request("take turn", {name: "Paul Blart"})
game.request("bruh", "fwgfww").catch(standardErrorHandler)
game.request("take turn", {name: "meobenvw"}).catch(standardErrorHandler)
game.request("join", {name: "fwfnwon"})

//Round 2
game.request("take turn", {name: "John Doe"})
game.request("take turn", {name: "Paul Blart"})

//Round 3
game.request("take turn", {name: "John Doe"})
game.request("take turn", {name: "Paul Blart"})

//Results
game.request("take turn", {name: "John Doe"}).catch(standardErrorHandler)


