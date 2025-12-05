export function green(text: string): string {
  return `\x1b[32m${text}\x1b[0m`;
}

export function orange(text: string): string {
  return `\x1b[38;5;208m${text}\x1b[0m`;
}

export function red(text: string): string {
  return `\x1b[31m${text}\x1b[0m`;
}

export function cyan(text: string): string {
  return `\x1b[36m${text}\x1b[0m`;
}
