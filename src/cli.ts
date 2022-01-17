import { readFileSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import yargs from 'yargs'

import { readCalendar } from './read-calendar.js'
import { renderEventsToImage } from './render-calendar.js'
import { readWeather } from './read-weather.js'
import { readBatteryLevel } from './read-battery.js'
import { runCommands } from './commands.js'
import { saveImageAndCompare } from './image.js' 

const DEFAULT_TOKEN_PATH = path.join(os.homedir(), '.calendar-e-paper', 'access-token.json')

const args = yargs(process.argv.slice(2))
  .config('config', function (configPath: string) {
    return JSON.parse(readFileSync(configPath, 'utf-8'))
  })
  .option('clientId', {
    description: 'Google Client ID to access Google Calendar',
    demandOption: true,
  })
  .option('clientSecret', {
    description: 'Google Client Secret to access Google Calendar',
    demandOption: true,
  })
  .option('width', {
    type: 'number',
    default: 640,
    description: 'The width to render the image to. If the render target is configured to an actual display this needs to match the driver'
  })
  .option('height', {
    type: 'number',
    default: 960,
    description: 'The height to render the image to. If the render target is configured to an actual display this needs to match the driver'
  })
  .option('tokenPath', {
    type: 'string',
    default: DEFAULT_TOKEN_PATH,
    description: 'This file will contain  the authentication token to access the chosen google calendar'
  })
  .option('calendar', {
    default: 'Family',
    description: 'Name of the calendar to render'
  })
  .option('openWeatherApiKey', {
    description: 'An API key for the OpenWeather API'
  })
  .option('latitude', {
    description: 'Latitude for Weather',
    type: 'number'
  })
  .option('longitude', {
    description: 'Longitude for Weather',
    type: 'number'
  })
  .option('language', {
    description: 'Language for Weather',
    type: 'string',
    default: 'en'
  })
  .option('simulate', {
    description: 'Re-use previously stored data files',
    type: 'bool'
  })
  .option('drawBorder', {
    description: 'Draw border around area',
    type: 'bool'
  })
  .option('afterRun', {
    description: 'Commands to execute when done (e.g poweroff). When the command starts with a number followed by an s: (e.g. 20s:/bash my-command.sh) the command will be delayed',
    array: true,
    type: 'string',
    coerce: function(option: string) {
      const afterRunCommands = []

      for (const command of option) {
        const secondSplitIndex = command.indexOf('s:')
        
        if (secondSplitIndex > 0) {
          afterRunCommands.push({ delay: parseInt(command.substring(0, secondSplitIndex), 10), command: command.substring(secondSplitIndex + 2) })
        } else {
          afterRunCommands.push({ delay: 0, command })
        }
      }

      return afterRunCommands
    }  
  })
  .argv

const events = args.simulate
  ? JSON.parse(await fs.readFile('events.json', { encoding: 'utf-8' }))
  : await readCalendar(args)

!args.simulate && await fs.writeFile('events.json', JSON.stringify(events, null, 2), { encoding: 'utf8' })
// const events = JSON.parse(await fs.readFile('events.json', { encoding: 'utf-8' }))

const weather = args.simulate
  ? JSON.parse(await fs.readFile('weather-report.json', { encoding: 'utf-8' }))
  : await readWeather({ apiKey: args.openWeatherApiKey, language: args.language, longitude: args.longitude, latitude: args.latitude })

!args.simulate && await fs.writeFile('weather-report.json', JSON.stringify(weather, null, 2), { encoding: 'utf8' })

// const batteryLevel = await readBatteryLevel()
const batteryLevel = 80;

const { imageBlack, imageRed } = await renderEventsToImage({ width: args.width, height: args.height, events, weather, batteryLevel, drawBorder: args.drawBorder })

const BLACK_CHANNEL_PATH = path.resolve('channel-black.png')
const RED_CHANNEL_PATH = path.resolve('channel-red.png')

const blackChanged = await saveImageAndCompare(imageBlack, BLACK_CHANNEL_PATH)
const redChanged = await saveImageAndCompare(imageRed, RED_CHANNEL_PATH)

const anyChange = blackChanged || redChanged

await runCommands(args.afterRun, {
  BLACK_CHANNEL: BLACK_CHANNEL_PATH,
  RED_CHANNEL: RED_CHANNEL_PATH,
  IMAGES_CHANGED: anyChange ? '1':'0',
})

// import { CLIENT_ID, CLIENT_SECRET } from '/etc'