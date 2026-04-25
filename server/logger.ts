const timestamp = () => `[${new Date().toLocaleString()}]`

export const logger = {
  log: (...args: unknown[]) => console.log(timestamp(), ...args),
  error: (...args: unknown[]) => console.error(timestamp(), ...args),
  warn: (...args: unknown[]) => console.warn(timestamp(), ...args),
  info: (...args: unknown[]) => console.info(timestamp(), ...args),
}
