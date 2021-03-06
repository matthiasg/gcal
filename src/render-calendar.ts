import fs from 'node:fs/promises'
import { createWriteStream, createReadStream } from 'node:fs'
import path from 'node:path'

import Jimp from 'jimp'
import linefold from 'linefold'
import * as PureImage from 'pureimage'
import { DateTime, Settings, Duration, Interval } from 'luxon'
import log from './log.js'
import { Context } from 'pureimage/types/context'

Settings.defaultLocale = 'de'

const DATA_PATH = path.resolve('data')

async function loadFont(fontFileName: string, name: string) {
  const font = PureImage.registerFont(path.join(DATA_PATH, 'fonts', fontFileName), name, null, null, null)
  await callbackResolve(cb => font.load(cb))
}

function fillEntireContext(ctx: Context, { width, height }: { width: number, height: number}) {
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = 'black'
}

function CUSTOM_FILTER(event) {
  if (event.summary.includes('Taschengeld')) return true

  return false
}

export async function renderEventsToImage({ width, height, weather, events, batteryLevel, drawBorder }: { width: number, height: number, weather: any, batteryLevel: number, drawBorder?: boolean, events: any[] }) {
  await loadFont('SourceSans3-Bold.ttf', 'SourceSans')
  await loadFont('SourceSans3-Regular.ttf', 'SourceSansRegular')
  await loadFont('SourceSans3-Light.ttf', 'SourceSansLight')
  // const font = PureImage.registerFont(path.join(dataPath, 'SourceSans3-Bold.ttf'), 'SourceSans', null, null, null)
  // await callbackResolve(cb => font.load(cb))

  // NOTE: Margins are absolute coordinates in the canvas
  const DRAW_LEFT_MARGIN = 0
  const LEFT_MARGIN = DRAW_LEFT_MARGIN + 20
  const RIGHT_MARGIN = width - 18
  const SECTION_GAP = 8
  const HEADER_GAP = 16
  const WEEK_GAP = 16

  const TOP_MARGIN = 5
  const BOTTOM_MARGIN = height - 28

  let   yPosition = TOP_MARGIN

//  const image = await createImage(width, height)
  const image = PureImage.make(width, height, null)
  const imageRed = PureImage.make(width, height, null)

  const now = DateTime.now()
  const today = now.set({hour: 0, minute: 0, second: 0, millisecond: 0})
  const tomorrow = today.plus(Duration.fromObject({ day: 1 }))
  const todayInterval = Interval.fromDateTimes(today, tomorrow.minus({ milliseconds: 1 }))
  const tomorrowInterval = Interval.fromDateTimes(tomorrow, tomorrow.plus({ days: 1 }).minus({ milliseconds: 1 }))
  const dayAfterTomorrowUntil14DaysInterval = Interval.fromDateTimes(tomorrow.plus({ days: 1 }).minus({ milliseconds: 1 }), tomorrow.plus({ days: 14 }).minus({ milliseconds: 1 }))

  const day = today.toLocaleString({ weekday: 'short', month: 'short', day: 'numeric'  })

  const ctx = image.getContext('2d')
  const ctxRed = imageRed.getContext('2d')

  fillEntireContext(ctx, { width, height })
  fillEntireContext(ctxRed, { width, height })

  // ctx.drawLine_noaa({ start: { x: LEFT_MARGIN, y: 0 }, end: { x: LEFT_MARGIN, y: height }})
  // ctx.drawLine_noaa({ start: { x: RIGHT_MARGIN, y: 0 }, end: { x: RIGHT_MARGIN, y: height }})

  // console.dir(weather, { depth: null })
  if (drawBorder) {
    log.info('Drawing border')
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'black'
    ctx.strokeRect(LEFT_MARGIN, TOP_MARGIN, RIGHT_MARGIN - LEFT_MARGIN, BOTTOM_MARGIN - TOP_MARGIN)

    ctxRed.lineWidth = 2;
    ctxRed.strokeStyle = 'black'
    ctxRed.strokeRect(LEFT_MARGIN, TOP_MARGIN, RIGHT_MARGIN - LEFT_MARGIN, BOTTOM_MARGIN - TOP_MARGIN)
  }

  console.log(day)

  yPosition = await renderHeadline({ yPosition, today, day, ctx, ctxRed, weather, LEFT_MARGIN, RIGHT_MARGIN })
  yPosition = await renderWeatherAlert({ yPosition, weather, ctx, ctxRed, LEFT_MARGIN, RIGHT_MARGIN })

  yPosition += SECTION_GAP

  const todaysEvents = readEvents(events, todayInterval)

  yPosition = renderMultiDayEvents({ events: todaysEvents, context: ctx, yPosition, LEFT_MARGIN, RIGHT_MARGIN, HEADER_GAP })
  yPosition += SECTION_GAP

  yPosition = renderEvents({ title: 'Heute', events: todaysEvents, context: ctx, contextSecond: ctxRed, yPosition, DRAW_LEFT_MARGIN, LEFT_MARGIN, RIGHT_MARGIN, HEADER_GAP, WEEK_GAP, width, height })
  yPosition += SECTION_GAP

  const tomorrowsEvents = readEvents(events, tomorrowInterval)
  yPosition = renderEvents({ title: 'Morgen', events: tomorrowsEvents, context: ctx, contextSecond: ctxRed, yPosition, DRAW_LEFT_MARGIN, LEFT_MARGIN, RIGHT_MARGIN, HEADER_GAP, WEEK_GAP, width, height, filter: CUSTOM_FILTER })
  yPosition += SECTION_GAP

  const remainder = readEvents(events, dayAfterTomorrowUntil14DaysInterval)
  yPosition = renderEvents({ title: 'Weitere', includeDate: true, events: remainder, context: ctx, contextSecond: ctxRed, yPosition, DRAW_LEFT_MARGIN, LEFT_MARGIN, RIGHT_MARGIN, HEADER_GAP, WEEK_GAP, width, height, filter: CUSTOM_FILTER })
  yPosition += SECTION_GAP
  
  await renderBatteryLevel({ batteryLevel, context: ctxRed, LEFT_MARGIN, RIGHT_MARGIN, BOTTOM_MARGIN, height })

  return exportAsChannels(image, imageRed)
}

function isMultiDayEvent(event: any) {
  if (!('date' in event.start) || !('date' in event.end)) {
    return false
  }

  const start = event.start.date ? DateTime.fromISO(event.start.date) : null
  const end = event.end.date ? DateTime.fromISO(event.end.date) : null

  const intervalOfEvent = Interval.fromDateTimes(start, end)
  
  if (intervalOfEvent.length('days') <= 1) {
    return false
  }

  return true
}

function renderMultiDayEvents({ events, context, yPosition, LEFT_MARGIN, RIGHT_MARGIN, HEADER_GAP }) {
  if (events.length === 0) {
    return yPosition
  }

  for (const event of events) {
    if (!('date' in event.start) || !('date' in event.end)) {
      continue
    }

    const start = event.start.date ? DateTime.fromISO(event.start.date) : null
    const end = event.end.date ? DateTime.fromISO(event.end.date) : null

    const intervalOfEvent = Interval.fromDateTimes(start, end)
    
    if (intervalOfEvent.length('days') <= 1) {
      continue
    }

    alreadyRendered.add(event)

    yPosition = renderTextLines({
      context: context,
      text: event.summary + ' bis ' + end.toLocaleString(DateTime.DATE_MED),
      xPosition: LEFT_MARGIN,
      yPosition,
      fontSize: 16,
      maxWidth: RIGHT_MARGIN - LEFT_MARGIN,
      fontFamily: 'SourceSansLight',
    })

    if (event.location && event.location.trim() !== '') {
      yPosition += 2
      yPosition = renderTextLines({
        context: context,
        text: event.location,
        xPosition: LEFT_MARGIN,
        yPosition,
        fontSize: 18,
        maxWidth: RIGHT_MARGIN - LEFT_MARGIN,
        fontFamily: 'SourceSansLight',
      })
    }
  }

  return yPosition
}

function renderSectionTitle({ title, context, yPosition, LEFT_MARGIN, RIGHT_MARGIN, HEADER_GAP }) {
  yPosition = renderTextLines({
    context,
    text: title,
    xPosition: LEFT_MARGIN,
    yPosition,
    fontSize: 20,
    maxWidth: RIGHT_MARGIN - LEFT_MARGIN,
    fontFamily: 'SourceSansLight',
  })
  
  yPosition += HEADER_GAP

  return yPosition
}

const alreadyRendered = new Set()

function renderEvents({ title, includeDate = false, width, height, events, context, contextSecond, yPosition, DRAW_LEFT_MARGIN, LEFT_MARGIN, RIGHT_MARGIN, HEADER_GAP, WEEK_GAP, filter = null }) {
  if (events.length === 0) {
    return yPosition
  }

  let headerRendered = false

  let lastEventWeek = null

  for (const event of events) {
    if (alreadyRendered.has(event)) { 
      continue
    }

    if (filter?.(event)) {
      continue
    }

    alreadyRendered.add(event)
    
    const eventStartDate = event.start.date ? DateTime.fromISO(event.start.date) : DateTime.fromISO(event.start.dateTime)
    const weekNumber = eventStartDate.weekNumber
    
    if (!headerRendered) {
      yPosition = renderSectionTitle({ title, context, yPosition, LEFT_MARGIN, RIGHT_MARGIN, HEADER_GAP })
      headerRendered = true
    }

    const sameWeekAsLastEventRendered = lastEventWeek === null ? true : weekNumber === lastEventWeek
    lastEventWeek = weekNumber

    if (!sameWeekAsLastEventRendered) {
      yPosition += WEEK_GAP
    }

    let offset = includeDate ? 140 : 50 // Math.min(timeMinWidth, 200) + 10
    
    const startDateTime = event.start.dateTime ? DateTime.fromISO(event.start.dateTime) : null
    let   prefixText = ''

    if (includeDate && startDateTime) {
      const shouldShowAsWeekday = isEventInNext7Days(startDateTime) 
      const timeText = `${startDateTime.toLocaleString(DateTime.TIME_24_SIMPLE)} `

      if (shouldShowAsWeekday) {
        const dayText = startDateTime.toFormat('ccc (d.L)')
        prefixText = `${dayText} ${timeText}`
      } else {
        const dateText = shouldShowAsWeekday ? startDateTime.toFormat('ccc') : startDateTime.toFormat('LLL dd');//.toLocaleString(DateTime.DATE_MED)
        prefixText = `${dateText} ${timeText}`
      }
    } else if (includeDate) {
      const startDate = event.start.date ? DateTime.fromISO(event.start.date) : null
      const endDate = event.end.date ? DateTime.fromISO(event.end.date).plus({ milliseconds: -1 }) : null
      
      if (startDate && endDate) {
        const shouldShowStartAsWeekday = isEventInNext7Days(startDate)
        const shouldShowEndAsWeekday = isEventInNext7Days(endDate) 
        
        const startText = shouldShowStartAsWeekday ? startDate.toFormat('ccc') : startDate.toFormat('LLL dd') 
        const endText = shouldShowEndAsWeekday ? endDate.toFormat('ccc') : endDate.toFormat('LLL dd')//.toLocaleString(DateTime.DATE_MED)

        if (startText === endText) {
          prefixText = startText
        } else {
          prefixText = `${startText}\n${endText}`
        }
      }
    }  else if (!includeDate && startDateTime) {
      prefixText = startDateTime.toLocaleString(DateTime.TIME_24_SIMPLE)
    }

    let prefixYPosition = yPosition

    if (prefixText.length > 0) {
      // const { width: timeMinWidth } = context.measureText(timeText)

      prefixYPosition = renderTextLines({
        context: context,
        text: prefixText,
        xPosition: LEFT_MARGIN,
        yPosition,
        fontSize: 16,
        lineHeight: 20,
        maxWidth: offset,
        fontFamily: 'SourceSans',
      })
    } else {
      offset = 0
    }

    yPosition = renderTextLines({
      context: context,
      text: event.summary,
      xPosition: LEFT_MARGIN + offset,
      yPosition,
      fontSize: 20,
      maxWidth: RIGHT_MARGIN - (LEFT_MARGIN + offset),
      fontFamily: 'SourceSansLight',
    })

    yPosition = Math.max(yPosition, prefixYPosition)

    if (event.location && event.location.trim() !== '') {
      yPosition += 2
      yPosition = renderTextLines({
        context: contextSecond,
        text: event.location,
        xPosition: LEFT_MARGIN + offset,
        yPosition,
        fontSize: 18,
        maxWidth: RIGHT_MARGIN - (LEFT_MARGIN + offset),
        fontFamily: 'SourceSansLight',
      })
      yPosition += 12
    }
  }

  return yPosition
}

interface Event {
  summary: string,
  location?: string,
  eventType: string,
  start: {
    date?: string
    dateTime?: string
  },
  end: {
    date?: string,
    dateTime?: string
  }
}

function readEvents(events: Event[], interval: Interval): Event[] {
  const eventsInRange = []

  for (const event of events) {
    // if (event.summary.indexOf('isches') <= 0) {
    //   continue
    // }

    try {
      // log.trace({ event }, 'Testing event "%s"', event.summary)

      const start = DateTime.fromISO(event.start.date ?? event.start.dateTime)
      const end = DateTime.fromISO(event.end.date ?? event.start.dateTime)

      const intervalOfEvent = Interval.fromDateTimes(start, end)
      
      if (intervalOfEvent.overlaps(interval)) {
        eventsInRange.push(event)
      }
    } catch (error) {
      log.warn({ error: error.toString() }, 'Error with event "%s" (%s-%s)', event.summary, event.start?.date, event.end?.date)
    }
  }

  log.trace({ interval }, '#%d Events in range %s', eventsInRange.length, interval)
  return eventsInRange
}

async function renderWeatherAlert({ ctx, ctxRed, yPosition, LEFT_MARGIN, RIGHT_MARGIN, weather }) {
  if (!weather.alerts) {
    return yPosition
  }

  const germanAlerts = findAllAlertsInGerman(weather.alerts)

  yPosition += 10

  for (const alert of germanAlerts) {
    yPosition = renderTextLines({
      context: ctxRed,
      text:  alert.description,
      xPosition: LEFT_MARGIN,
      yPosition,
      fontSize: 20,
      maxWidth: RIGHT_MARGIN - LEFT_MARGIN,
      fontFamily: 'SourceSansRegular',
    })
  }

  return yPosition
}

function isEventInNext7Days(dateTime: DateTime) {
  const numberOfDaysUntil = dateTime.diffNow().as('days')
  log.trace({ dateTime, numberOfDaysUntil }, "How many days" )
  // return true
  return (numberOfDaysUntil < 8)
}

async function renderBatteryLevel({ batteryLevel, context, LEFT_MARGIN, RIGHT_MARGIN, BOTTOM_MARGIN, height }) {
  if (batteryLevel == null) {
    return
  }

  const fontSize = 18

  renderTextLines({
    context,
    text: 'Batterie: ' + batteryLevel.toString() + '%',
    xPosition: LEFT_MARGIN,
    yPosition: BOTTOM_MARGIN - fontSize,
    fontSize,
    maxWidth: RIGHT_MARGIN - LEFT_MARGIN,
    fontFamily: 'SourceSansLight',
  })
}

function renderTextLines({ context, text, lineHeight, yPosition, fontSize, fontFamily, xPosition, maxWidth, gap = 0 }: { context: any, text: string, lineHeight?: number, fontSize: number, xPosition: number, yPosition: number, fontFamily: string, maxWidth: number, gap?: number }) {
  lineHeight = lineHeight ?? fontSize

  const lines = linefold(text, maxWidth, (text: string) => {
    const { width: textWidth } = context.measureText(text)
    return textWidth
  })

  for (const line of lines) {
    context.font = `${fontSize}pt '${fontFamily}'`
    yPosition += lineHeight + gap
    context.fillText(line, xPosition, yPosition)
  }

  return yPosition
}

type WeatherAlert = {
  sender_name: string
  event: string
  start: number
  end: number
  description: string
  tags: string[]
}

function findAllAlertsInGerman(allAlerts: WeatherAlert[]) {
  const germanAlerts: WeatherAlert[] = []
  
  for (const alert of allAlerts) {
    const isEventAllUppercase = isAllUppercase(alert.event)
  
    if (isEventAllUppercase) {
      germanAlerts.push(alert)
    }
  }

  log.trace({ germanAlerts }, '#%d German Weather Alerts', germanAlerts.length)
  
  return germanAlerts
}

function isAllUppercase(event: string) {
  return event.toLocaleUpperCase() === event
}

async function renderHeadline({ ctx, ctxRed, today, day, yPosition, LEFT_MARGIN, RIGHT_MARGIN, weather }: { ctx: Context, ctxRed: Context, today: string, day: string, yPosition: number, LEFT_MARGIN: number, RIGHT_MARGIN: number, weather: any }) {
  ctx.font = "38pt 'SourceSans'"
  const { width: headerWidth } = ctx.measureText(day)

  yPosition += 38
  ctx.fillText(day, LEFT_MARGIN, yPosition)
  ctx.lineWidth = 2

  yPosition += 6
  ctx.drawLine_aa({ start: { x: LEFT_MARGIN, y: yPosition}, end: { x: LEFT_MARGIN + headerWidth, y: yPosition }})

  yPosition = 0
  yPosition = 38
  const temperatur = `${Math.round(weather.current.temp)}??`
  const { width: topRightWidth } = ctx.measureText(temperatur)
  ctxRed.font = "30pt 'SourceSans'"
  ctxRed.fillText(temperatur, RIGHT_MARGIN - topRightWidth, yPosition)

  // await renderWeatherIcon({ ctx, iconName: '01d.png', xPosition: RIGHT_MARGIN - topRightWidth - 128 - 16, yPosition: 0, width: 38, height: 38 })

  yPosition = 42

  return yPosition
}

async function exportAsChannels(image: any, imageRed: any) {
  await PureImage.encodePNGToStream(image, createWriteStream('calendar.png'))
  await PureImage.encodePNGToStream(imageRed, createWriteStream('calendar-red.png'))
  
  //   (err, image, { x, y }) => {
  //     image.print(font, x, y + 20, 'More text on another line', 50);
  //   }
  // );
  const jimpImage = await new Promise<any>((resolve, reject) => {
    Jimp.read('calendar.png', (err, image) => {
      if (err) {
        reject(err)
      } else {
        fs.unlink('calendar.png')
        resolve(image)
      }
    })
  })

  jimpImage.posterize(2)

  const jimpImageRed = await new Promise<any>((resolve, reject) => {
    Jimp.read('calendar-red.png', (err, image) => {
      if (err) {
        reject(err)
      } else {
        fs.unlink('calendar-red.png')
        resolve(image)
      }
    })
  })
  
  jimpImageRed.posterize(2)

  return { imageBlack: jimpImage, imageRed: jimpImageRed }
}

function callbackResolve(functionToInjectCallbackInto: any) {
  return new Promise(resolve => {
    functionToInjectCallbackInto(resolve)
  })
}

async function renderWeatherIcon({ ctx, iconName, xPosition, yPosition, width, height }) {
  const iconPath = path.join(DATA_PATH, 'openweathermap', 'icons', iconName)
 
  const icon = await PureImage.decodePNGFromStream(createReadStream(iconPath))
  ctx.drawImage(icon, xPosition, yPosition, width, height)
}
