import {
  buildSync,
  Loader,
  transformSync,
  CommonOptions,
  TransformOptions,
  BuildOptions,
} from "esbuild"
import fs from "fs"
import path from "path"
import { PackageJson } from "type-fest"
import cache from "./cache"

export type TranspileOptions = {
  type: "bundle" | "transform"
  debug: boolean
  cwd?: string
  esbuild?: CommonOptions & TransformOptions & BuildOptions
}
const defaultOptions: TranspileOptions = { type: "bundle", debug: false }

const commonOptions: CommonOptions = {
  format: "cjs",
  logLevel: "error",
  target: [`node${process.version.slice(1)}`],
  minify: false,
  sourcemap: "inline",
}

export const loaders: Record<string, Loader> = {
  ".js": "js",
  ".mjs": "js",
  ".cjs": "js",
  ".jsx": "jsx",
  ".ts": "ts",
  ".tsx": "tsx",
  // ".css": "css",
  ".json": "json",
  // ".txt": "text",
}

export function supports(filename: string) {
  if (filename.includes("node_modules")) return false
  return path.extname(filename) in loaders
}

function _transform(
  code: string,
  filename: string,
  options: TranspileOptions
): string {
  const loaders = getLoaders(options)
  const ret = transformSync(code, {
    ...commonOptions,
    ...(options.esbuild as TransformOptions | undefined),

    loader: loaders[path.extname(filename)],
    sourcefile: filename,
  })
  return ret.code
}

function getLoaders(options: TranspileOptions) {
  const ret = { ...loaders }
  if (typeof options.esbuild?.loader == "object") {
    for (const [e, l] of Object.entries(options.esbuild.loader))
      ret[e] = l as Loader
  }
  return ret
}

function _bundle(
  code: string,
  filename: string,
  options: TranspileOptions
): string {
  const ext = path.extname(filename)

  const loaders = getLoaders(options)

  return buildSync({
    ...commonOptions,
    platform: "node",
    ...(options.esbuild as BuildOptions | undefined),
    loader: loaders,
    bundle: true,
    stdin: {
      sourcefile: filename,
      contents: code,
      resolveDir: path.dirname(filename),
      loader: loaders[ext],
    },
    write: false,
  })
    .outputFiles.map((f) => f.text)
    .join("\n")
}

export function transpile(
  code: string,
  filename: string,
  _options?: Partial<TranspileOptions>
): string {
  const pkgPath = path.resolve(_options?.cwd ?? ".", "package.json")
  let externals: string[] = []
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(
      fs.readFileSync(pkgPath, { encoding: "utf-8" })
    ) as PackageJson
    externals = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ]
  } else if (_options?.cwd) {
    throw new Error(`No package.json found in ${_options?.cwd}`)
  }
  const options: TranspileOptions = {
    ...defaultOptions,
    ..._options,
    esbuild: {
      ..._options?.esbuild,
      external: [...externals, ...(_options?.esbuild?.external ?? [])],
    },
  }
  if (options.type == "bundle") {
    // eslint-disable-next-line no-console
    if (options.debug) console.log(`📦 ${filename}`)
    return _bundle(code, filename, options)
  } else if (options.type == "transform") {
    return cache.get(filename, () => {
      // eslint-disable-next-line no-console
      if (options.debug) console.log(`📦 ${filename}`)
      return _transform(code, filename, options)
    })
  }
  throw new Error(`Invalid transpilation option ${options.type}`)
}
