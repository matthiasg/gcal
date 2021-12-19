import log from './log.js'
import fetch from 'node-fetch'

export async function readWeather({ apiKey, longitude, latitude, language}: { apiKey?: string, longitude: number, latitude: number, language: language } = {}) {
  if (!apiKey) {
    return
  }

  if (longitude == null || latitude == null) {
    log.warn('Cannot load weather without latitude and longitude')
  }

  log.trace({ longitude, latitude }, 'Reading weather')

  const response = await fetch(`https://api.openweathermap.org/data/2.5/onecall?lang=${language}&lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric`)
  
  if (!response.ok) {
    log.warn({ response }, 'Could not read response: %s', await response.text())
    return
  }

  return response.json()
}