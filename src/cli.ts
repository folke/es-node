/* eslint-disable no-process-exit */
import fs from "fs"
import Module from "module"
import path from "path"
import cache from "./cache"
import { install } from "./hook"

function help() {
  // eslint-disable-next-line no-console
  console.log(`Usage: esr [options] <source-file> [file-options]

  --cache       Transform on a file per file basis and cache code
  --clearCache  Clear transform cache
  --help|-h     Display this help message
  `)
  process.exit(1)
}

function parseArgs(args: string[] = process.argv) {
  const nodePath = args[0]
  // Remove node path
  args.shift()
  // Remove esr path
  args.shift()

  const options = { debug: false, cache: false }

  for (let a = 0; a < args.length; a++) {
    const arg = args[a]
    switch (arg) {
      case "--help":
      case "-h": {
        help()
        continue
      }

      case "--clearCache":
      case "--clear-cache": {
        cache.clear()
        // eslint-disable-next-line no-console
        console.log(`Cleared ${cache.tmpPath}`)
        process.exit(0)
        continue
      }

      case "--cache": {
        options.cache = true
        continue
      }

      case "--debug": {
        options.debug = true
        continue
      }

      default: {
        args = args.slice(a)
        args.unshift(nodePath)
        return { options, args }
      }
    }
  }
  return { options, args: [nodePath] }
}

export function main() {
  const { options, args } = parseArgs()

  if (args.length >= 2 && fs.existsSync(args[1])) {
    process.argv = args
    process.argv[1] = path.resolve(process.argv[1])
    install({
      type: options.cache ? "transform" : "bundle",
      debug: options.debug,
    })
    Module.runMain()
  } else {
    help()
  }
}
