function phase(){
  const subscribers = new Set()
  const phaseSubscribers = new Set()
  function e (name, ...args) { 
    const subs = [...subscribers, ...phaseSubscribers]
    if(subs.every(s => (s.name != name))) console.error("Action not found:", name)
    else subs.forEach(s => s.name == name && s.fn(...args))
  }
  e.on = (name, fn) => { phaseSubscribers.add({name, fn}) }
  e.off = (name, fn) => { phaseSubscribers.delete({name, fn}) }
  e.clear = () => { phaseSubscribers.clear() }
  e.onAll = (name, fn) => { subscribers.add({name, fn}) }
  e.offAll = (name, fn) => { subscribers.delete({name, fn}); phaseSubscribers.delete({name, fn}) }
  e.clearAll = () => { subscribers.clear(); phaseSubscribers.clear() }
  return e
}

class Game {
  constructor(){
    this.phases = []
    this.phaseObj = phase()
  }

  get currentPhase () { return this.phases[0] }

  start(){
    this.currentPhase(this.phaseObj, (err)=> {
      this.nextPhase()
    })
  }

  nextPhase(){
    this.phases.shift()
    this.phaseObj.clear()
    this.start()
  }

  usePhase(...phases){
    this.phases.push(...phases)
  }

  request(name, ...args) {
    this.phaseObj(name, ...args)
  }
}

(()=>{
  const game = new Game()

  game.usePhase(
    (phase, next)=>{
      console.log("Join phase")

      phase.on("join", (val)=> {
        console.log(val, "joined")
      })

      phase.onAll("next", ()=> next())
      phase.onAll("execute", (val, fn)=> fn(val))
      phase.onAll("leave", ()=> {})
    }
  )

  for(let i = 0; i < 3; i++){
    game.usePhase(
      (phase, next)=>{
        console.log("Round ", i+1)

        phase.on("take turn", (val)=>{
          console.log(val)
        })
      }
    )
  }

  game.usePhase(
    (phase, next)=>{
      console.log("Results phase")
    }
  )

  game.start()

  game.request("join", "John Doe")
  game.request("take turn", "123456")
  game.request("next")

  game.request("take turn", "123456")
  game.request("bruh", "fwgfww")
  game.request("take turn", "meobenvw")
  game.request("join", "fwfnwon")
  game.request("next")

  game.request("take turn", "fbwibwf")
  game.request("execute", 450, (val)=> console.log("executed:", val * 2))

  game.request("next")
  game.request("next")
})()