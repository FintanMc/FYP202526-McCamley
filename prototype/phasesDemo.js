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
  return {catch: (callback) => err && callback(err)}
}

function action(value){
  const subs = new Set()
  const e = () => subs.forEach(s => s.fn(value))
  e.subscribe = (fn) => {
    subs.add({fn})
    const u = () => {
      fn(value)
      return u
    }
    u.unsubscribe = () => subs.delete({fn})
    return u
  }
  e.unsubscribe = (fn) => subs.delete({fn})
  e.clear = () => subs.clear()
  return e
}

class Repo {
  #repository = new Map()
  #deletion = new Map()
  onChange = action()

  get = (key) => this.#repository.get(key)
  query = (fn) => [...this.#repository.values()].filter(fn)
  get array() { return [...this.#repository.values()] }
  get keys() { return [...this.#repository.keys()] }

  add = (key, value) => { this.#repository.set(key, value); this.cancelDeletion(key); this.onChange(); return value }
  update = (key, fn) => { this.#repository.set(key, fn(this.#repository.get(key))); this.onChange() }
  delete = (key) => { this.#repository.delete(key); this.onChange() }
  clear = () => { this.#repository.clear(); this.onChange() }
  
  cancelDeletion = (key) => { this.#deletion.get(key)?.close(); this.#deletion.delete(key) }
  queueForDeletion = (key, done) => { this.#deletion.set(key, setTimeout(()=> { this.#repository.delete(key); done() }, 1000 * 10)) }
  
  getOrAdd = (key, value) => this.get(key) || this.add(key, value)
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

  update = action(this)

  action(name, ...args){
    const subscribers = [...this.#subs, ...this.#allPhasesSubs]
    if(subscribers.every(s => (s.name != name))) throw new ActionNotFoundError(name)
    subscribers.forEach(s => s.name == name && s.fn(...args))
  }
}

class Game {
  constructor(){
    this.phases = []
    const players = new Repo()
    this.state = new GameState({
      players
    })

    players.onChange.subscribe(() => this.state.update())
  }

  get currentPhase () { return this.phases[0] }

  start(){
    this.currentPhase(this.state, (err)=> {
      this.nextPhase()
    })
    this.state.update()
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

  onUpdate = (fn) => this.state.update.subscribe(fn)
}


const game = new Game()

game.usePhase(
  (state, next)=>{
    state.title = "Join phase"

    state.allPhases.on("disconnect", (player, done) => {
      state.players.queueForDeletion(player.id, ()=>{
        done(player)
      })
    })

    state.on("join", (val, done)=> done(state.players.getOrAdd(val.id, {...val, score: 0})))

    state.on("start", ()=> {
      next()
    })
  },

  (state, next)=>{
    state.title = "Game phase"
  }
)

game.start()

const express = require("express")
const app = express()
const cookieParser = require("cookie-parser")

app.use(
  express.json(), 
  express.urlencoded({ extended: true }),
  cookieParser()
)

const apiRouter = express.Router()

apiRouter.use((req, res, next) => {
  req.sessionId = req.cookies.sessionId || null
  console.log("API request:", req.method, req.url, JSON.stringify(req.cookies))
  next()
})

apiRouter.post("/join", (req, res) => {
  if(!req.sessionId) res.cookie("sessionId", crypto.randomUUID(), {httpOnly: true})

  game.request("join", {id: req.sessionId, name: req.body.name}, (player) => {
    console.log("Player joined:", player)
    res.send(player)
  })
  .catch((err) => {
    console.error(err)
    res.status(err.status || 500).send({error: err.name, message: err.message})
  })
})

apiRouter.post("/start", (req, res) => {
  game.request("start")
  .catch((err) => {
    console.error(err)
    res.status(err.status || 500).send({error: err.name, message: err.message})
  })
})

app.use("/api", apiRouter)

app.use(
  express.static("public/test2")
)

const server = app.listen(3000, () => {
  console.log("Server listening on port 3000")
})

const {Server} = require("socket.io")

const io = new Server(server)

const parseCookies = (cookieString) => {
  return cookieString.split("; ").reduce((acc, cookie) => {
    const [name, value] = cookie.split("=")
    acc[name] = value
    return acc
  }, {})
}

io.on("connection", (socket) => {
  const { sessionId } = parseCookies(socket.handshake.headers.cookie || "")
  console.log("Socket connected:", socket.id, sessionId)

  const subs = []
  let player

  socket.on("sync", () => {
    game.request("join", {id: sessionId}, (p) => {
      console.log("Sync request from", p.name)
      player = p
    })
  })

  subs.push(
    game.onUpdate((state) => {
      socket.emit("update", {
        title: state.title,
        players: state.players.array
      })
    })(/*call once*/)
  )

  socket.on("disconnect", () => {
    game.request("disconnect", {id: sessionId}, (p) => {
      console.log("Player left:", p)
    })
    subs.forEach(sub => sub.unsubscribe())
  })
})