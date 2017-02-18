const exec = require('child_process').exec
const express = require('express')
const app = express()
const Client = require('ssh2').Client
const ssh2s = require("ssh2-streams")
const sshHost = process.env.SSH_HOST
const sshUsername = process.env.SSH_USERNAME
const sshPassword = process.env.SSH_PASSWORD
const log = require('winston')
const morgan = require('morgan')
const assert = require('assert')

assert(sshHost && sshUsername && sshPassword, 'SSH credentials not found! Set SSH_HOST, SSH_USERNAME & SSH_PASSWORD environment variables')

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

  const conn = new Client()
  conn
    .on('ready', () => {
      let output = ''

      conn.exec("{ wl -i eth2 assoclist; wl -i eth1 assoclist; } | cut -d' ' -f2", (err, stream) => {
        if(err) {
          log.error(err)
          res.status(500).end()
          return
        }

        stream
          .on('data', data => output += data)
          .on('close', () => {
            const response = { deviceDetected: output.trim().includes(req.params.mac) }
            res.json(response)
            conn.end()
            log.info("Wifi checked", req.params.mac, response)
          })
      })
    })
    .on('error', err => {
      log.error(err, 'Error with SSH connection')
      res.status(500).end()
    })
    .connect({
      host: sshHost,
      port: 22,
      username: sshUsername,
      password: sshPassword,
      algorithms: {
        kex: ssh2s.constants.ALGORITHMS.SUPPORTED_KEX
      }
   })
})


app.listen(4000, function() {
  log.info('HA presence detector listening on port 4000')
})