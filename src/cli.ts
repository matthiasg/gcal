import { readFileSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import yargs from 'yargs'

import { readCalendar } from './read-calendar.js'
import { renderEventsToImage } from './render-calendar.js'
import { readWeather } from './read-weather.js'
import { readBatteryLevel } from './read-battery.js'

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
  .option('afterRun', {
    description: 'Command to execute when done (e.g poweroff)',
    type: 'string'
  })
  .option('afterRunDelay', {
    description: 'Number of seconds to wait after done to run the afterRun command',
    type: 'number',
    default: 30
  })
  .option('afterRunCondition', {
    description: 'File '
  })
  .argv

const events = await readCalendar(args)
await fs.writeFile('events.json', JSON.stringify(events, null, 2), { encoding: 'utf8' })
// const events = JSON.parse(await fs.readFile('events.json', { encoding: 'utf-8' }))

const weather = await readWeather({ apiKey: args.openWeatherApiKey, language: args.language, longitude: args.longitude, latitude: args.latitude })
await fs.writeFile('weather-report.json', JSON.stringify(weather, null, 2), { encoding: 'utf8' })
// const weather = JSON.parse(await fs.readFile('weather-report.json', { encoding: 'utf-8' }))

//const batteryLevel = await readBatteryLevel()
const batteryLevel = null;

const { imageBlack, imageRed } = await renderEventsToImage({ width: args.width, height: args.height, events, weather, batteryLevel })

imageBlack.write('channel-black.png')
imageRed.write('channel-red.png')

// import { CLIENT_ID, CLIENT_SECRET } from '/etc't