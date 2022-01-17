import { Stream } from 'node:stream'
import net from 'node:net'
import { StringDecoder } from 'node:string_decoder'
import log from './log.js'

export async function readBatteryLevel(): Promise<number> {
  // echo "get battery" | nc -q 0 127.0.0.1 8423
  try {
    const socket = await connectToBattery()
    const pendingResponse = readNextLine(socket)

    socket.write('get battery\n', 'utf-8');

    const response = await pendingResponse
    log.info('Battery response %s', response)

    // e.g battery: 6.6470327
    const [,level] = response.split(':').map(l => l.trim())
    return parseFloat(level)
  } catch (error) {
    log.warn('Could not read battery level', error.toString())
    return null
  } 
}

async function readNextLine(stream: Stream): Promise<string> {
  let resolved = false

  return new Promise((resolve, reject) => {
    let   text = ''
    const decoder = new StringDecoder()

    stream.on('data', function (data: Buffer) {
      text += decoder.write(data)

      var n = text.indexOf('\n')
      // got a \n? emit one or more 'line' events

      // while (n >= 0) {
      if (n >= 0) {
        resolve(text.substring(0, n))
        resolved = true
        return
      }

        // text = text.substring(n + 1)
        // n = text.indexOf('\n')
      // }
    })
    // stream.on('end', function () {
    //   if (!resolved) {
    //     if (text) {
    //       resolve(text)
    //     }
    //   }
    // })
  })
}

async function connectToBattery(): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket()
    socket.once('connect', () => resolve(socket))
    socket.once('error', e => reject(e))
    socket.connect(8423, '127.0.0.1')
  })
}
