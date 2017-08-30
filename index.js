const exec = require('child_process').exec
const express = require('express')
const app = express()
const telnetHost = process.env.HOST
const username = process.env.USERNAME
const password = process.env.PASSWORD
const log = require('winston')
const morgan = require('morgan')
const assert = require('assert')
const Telnet = require('telnet-client')

assert(telnetHost && username && password, 'Telnet credentials not found! Set HOST, USERNAME & PASSWORD environment variables')

app.use(morgan('combined'))

app.get('/bt/:mac', (req, res) => {

  exec('hcitool name ' + req.params.mac, (error, stdout) => {
    if(error) {
      log.error(`exec error: ${error}`)
      res.status(500).end()
      return
    }

    const response = { deviceDetected: stdout.trim().length > 0 }
    res.json(response)
    log.info("BT checked", req.params.mac, response)
  })

})


app.get('/wifi/:mac', (req, res) => {

  const params = {
    host: telnetHost,
    username: username,
    password: password,
    timeout: 4000
  }

  const conn = new Telnet()
  conn.on('error', handleError)
  conn.on('failedlogin', () => handleError('Login failed'))
  conn.on('timeout', () => handleError('Timeout'))

  conn.connect(params)
    .then(() => conn.exec('(wlanconfig ath0 list sta; wlanconfig ath1 list sta) | grep -v ADDR | cut -d" " -f 1'))
    .then(macList => {
      const response = { deviceDetected: macList.trim().toLowerCase().includes(req.params.mac.toLowerCase()) }
      res.json(response)
      log.info("Wifi checked", req.params.mac, response)
      conn.end()
    })
    .catch(handleError)


  function handleError(e) {
    log.error(e)
    res.status(500).end()
    conn.end()
  }
})


app.listen(4000, function() {
  log.info('HA presence detector listening on port 4000')
})
