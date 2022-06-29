import fs from 'node:fs'
import express from 'express'
import { createRandomStream } from './random-stream.js'

const bytes = Number(1024n * 1024n * 1024n * 2n)
const app = express()

console.log(`hold on one sec creating a random file of ${bytes.toLocaleString()} bytes...`)

createRandomStream(Number(bytes))
  .pipe(fs.createWriteStream('./public/random.bin'))
  .once('finish', () => {
    app.use(express.static('./public'))
    const server = app.listen(() => {
      console.log('app running on:')
      console.log(`http://localhost:${server.address().port}`)
    })
  })