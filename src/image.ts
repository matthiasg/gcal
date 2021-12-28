import Jimp from 'jimp'
import log from './log.js'

export async function saveImageAndCompare(image: any, filePath: string) {
  let different = true

  try {
    const previousImage = await Jimp.read(filePath)
    const pixelDifference = Jimp.diff(previousImage, image)

    log.info({ filePath, percent: pixelDifference.percent }, 'Difference to earlier image: %d', pixelDifference.percent)
    different = (pixelDifference.percent > 0) 
  } catch (error) {
    log.info({ filePath }, 'Could not calculate difference of image %s => %s', filePath, error.toString())
  }

  await image.write(filePath)

  return different
}
