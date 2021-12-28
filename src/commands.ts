import { exec } from 'node:child_process'
import log from './log.js'

type Command = {
  delay: number,
  command: string,
}

interface EnvironmentVariables {
  [key: string]: string
}

export async function runCommands(commands: Command[], variables: EnvironmentVariables) {
  for (const { delay, command } of commands) {
    log.info({ variables }, 'Executing command %s in %d seconds', command, delay)
    await sleep(delay * 1000)
    await execCommand(command, variables)
  }
}

function execCommand(commandLine: string, variables: EnvironmentVariables): Promise<unknown> {
  const env = { ...process.env, ...variables }

  return new Promise((resolve, reject) => {
    log.trace('Executing command %s', commandLine)
    
    exec(commandLine, { env, timeout: 600, cwd: process.cwd() }, (error: any, stdout: string, stderr: string) => {
      if (error) {
        log.error('Error executing command %s', error.toString())
        reject(error)
      } else {
        const lines = stdout.split('\n').map(l => l.trim())
        if (lines[lines.length - 1] === '') {
          lines.pop()
        }

        lines.forEach(l => log.trace('Command stdout: %s', l))

        log.info('Executed command %s', commandLine)
        resolve(stdout)
      }
    })
  })
}

function sleep(ms: number) {
  if (!ms) {
    return 
  }

  return new Promise((resolve) => setTimeout(resolve, ms))
}
