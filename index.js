const exec = require('child_process').exec
const express = require('express')
const app = express()
const unifiHost = process.env.UNIFI_HOST || 'unifi.chacal.fi'
const unifiUsername = process.env.UNIFI_USERNAME
const unifiPassword = process.env.UNIFI_PASSWORD
const log = require('winston')
const assert = require('assert')
const unifi = require('node-unifi')
const Bluebird = require('bluebird')

assert(unifiUsername && unifiPassword, 'Unifi credentials not found! Set UNIFI_USERNAME & UNIFI_PASSWORD environment variables')

const ALLOWED_TIME_SINCE_LAST_SEEN_MS = 35 * 1000
const controller = new unifi.Controller(unifiHost, 8443)

controller.login(unifiUsername, unifiPassword, err => {
  if(err) {
    log.error('Error when logging in to Unifi Controller.', err)
  }
})

app.get('/bt/:mac', (req, res) => {

  exec('hcitool name ' + req.params.mac, (error, stdout) => {
    if(error) {
      log.error(`exec error: ${error}`)
      res.status(500).end()
      return
    }

    const response = {deviceDetected: stdout.trim().length > 0}
    res.json(response)
  })

})


app.get('/wifi/:mac', (req, res) => {

  Bluebird.fromCallback(cb => controller.getClientDevice('default', cb, req.params.mac.toLowerCase()))
    .then(res2 => {
      const deviceDetected = res2 && res2[0] && res2[0][0] && (new Date() - new Date(parseInt(res2[0][0].last_seen) * 1000) < ALLOWED_TIME_SINCE_LAST_SEEN_MS)
      res.json({deviceDetected})
    })
    .catch(e => e.toString().includes('UnknownUser'), () => {
      res.json({deviceDetected: false})
    })
    .catch(handleError)

  function handleError(e) {
    log.error(e)
    res.status(500).end()
  }
})


app.listen(4000, function() {
  log.info('HA presence detector listening on port 4000')
})
