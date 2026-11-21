const crypto = require("crypto")

class GameState{
  constructor(host, rounds){
    this.users = new Set()
    this.joinGame(host)
    this.userLeft = signal(null)

    this.phaseQueue = [
      new JoinPhase(this),
      new RulesPhase(this),
      ...new Array(rounds).keys().map((n) => 
        new RoundPhase(this, n + 1)
      ),
      new ResultsPhase(this)
    ]
  }

  start(){this.nextPhase()}

  nextPhase(){
    if(this.phaseQueue.length == 0) return
    this.phaseQueue[0].begin(this.users)
    this.phaseQueue = this.phaseQueue.slice(1)
  }

  joinGame(user){
    console.log("user joined:", user)
    this.users.add(new User(user))
  }

  leaveGame(user){
    this.users.delete(user)
    this.userLeft.set(user)
  }
}

class User{
  constructor(name){
    this.name = name
    this.score = 0
  }
}

class Phase {
  constructor (gameState) {
    this.nextPhase = () => gameState.nextPhase()
  }
}

class JoinPhase extends Phase{
  constructor(gameState){
    super(gameState)
    this.joinGame = (u) => gameState.joinGame(u)
  }

  begin(){
    console.log("--- Join phase")

    for(let i = 0; i++ < 10;){
      this.joinGame(crypto.randomUUID())
    }
    
    setTimeout(()=> this.nextPhase(), 1000)
  }
}

class RulesPhase extends Phase{
  constructor(gameState){
    super(gameState)
  }

  begin(){
    console.log("\n--- Rules phase \nTake turns and gain points, the winner is the person with the most points at the end")

    setTimeout(()=> this.nextPhase(), 1000)
  }
}

class RoundPhase extends Phase{
  constructor(gameState, roundNumber){
    super(gameState)
    this.userLeft = gameState.userLeft

    this.roundNumber = roundNumber
    this.turns = new Set()
  }

  begin(users){
    console.log("\n--- Round", this.roundNumber)
    const usersQueue = [...users]

    const pendingRejoin = []
    this.userLeft.subscribe((user)=> pendingRejoin.push(user))

    const interval = setInterval(()=>{
      if (users.size == this.turns.size) {
        this.nextPhase()
        return clearInterval(interval)
      }
      
      const usersTurn = usersQueue.shift()
      usersTurn.score += Math.round(Math.random()*100)
      console.log(usersTurn)

      this.turns.add(usersTurn)
    }, 100)
  }
}

class ResultsPhase extends Phase{
  constructor(gameState){
    super(gameState)
  }

  begin(users){
    console.log("\n--- Results phase")

    const usersList = [...users].sort((a, b) => b.score - a.score)

    for(let i = 0; i < usersList.length; i++){
      const user = usersList[i]
      console.log(["🥇", "🥈", "🥉"][i] || "", user.name, ":", user.score)
    }

    setTimeout(() => this.nextPhase(), 1000);
  }
}

function signal(value){
  let val = value
  const subscribers = new Set()

  function sig(){
    subscribers.forEach(s=>s(val))
    return val
  }
  sig.set = (value) => {
    subscribers.forEach(s=>s(val))
    val = value
  }
  sig.update = (evaluate) => sig.set(evaluate(val))
  sig.subscribe = (evaluate) => subscribers.add(evaluate)
  sig.unsubscribe = (evaluate) => subscribers.delete(evaluate)

  return sig
}

(()=>{
  const game = new GameState(crypto.randomUUID(), 3)
  game.start()
})()